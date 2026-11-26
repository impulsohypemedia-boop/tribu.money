'use client'

import {
    authenticate,
    callSmartContract,
    ClaimKey,
    ContractStandard,
    isLemonWebView,
    TransactionResult,
} from '@lemoncash/mini-app-sdk'
import { api } from '@/lib/api'
import { lemonNetwork, type StablecoinConfig } from './chain'

/**
 * The browser half of Tribu's Lemon integration. Everything here is a no-op outside Lemon's app:
 * `detectLemon` answers false and nothing else is called.
 */

/** Lemon's detection is a message round trip; outside the app nobody answers, so it is capped. */
const DETECT_TIMEOUT_MS = 1500

export async function detectLemon(): Promise<boolean> {
    if (typeof window === 'undefined' || !window.ReactNativeWebView) return false
    try {
        return await Promise.race([
            isLemonWebView(),
            new Promise<boolean>((resolve) => setTimeout(() => resolve(false), DETECT_TIMEOUT_MS)),
        ])
    } catch {
        return false
    }
}

export interface LemonSession {
    wallet: string
    message: string
    signature: string
    lemonTag: string | null
    name: string | null
}

export type LemonSignInResult = { ok: true; session: LemonSession } | { ok: false; cancelled: boolean }

/** Lemon requires this on every entry, before any other SDK call. */
export async function lemonSignIn(): Promise<LemonSignInResult> {
    const { nonce } = await api.lemonNonce()
    const response = await authenticate({
        nonce,
        chainId: lemonNetwork().chainId,
        requirements: { claims: [ClaimKey.LEMONTAG, ClaimKey.NAME] },
    })
    if (response.result !== TransactionResult.SUCCESS) {
        return { ok: false, cancelled: response.result === TransactionResult.CANCELLED }
    }
    const claim = (key: ClaimKey) => response.data.grantedClaims.find((granted) => granted.key === key)?.value ?? null
    return {
        ok: true,
        session: {
            wallet: response.data.wallet,
            message: response.data.message,
            signature: response.data.signature,
            lemonTag: claim(ClaimKey.LEMONTAG),
            name: claim(ClaimKey.NAME),
        },
    }
}

export type StablecoinPaymentResult =
    { status: 'sent'; txHash: string } | { status: 'cancelled' } | { status: 'failed'; message: string }

/** One ERC-20 `transfer` from the user's Lemon wallet. Lemon shows its own confirmation screen. */
export async function payStablecoin(input: {
    token: StablecoinConfig
    to: string
    tokenAmount: string
    title: string
}): Promise<StablecoinPaymentResult> {
    const response = await callSmartContract({
        contracts: [
            {
                contractAddress: input.token.address,
                functionName: 'transfer',
                functionParams: [input.to, input.tokenAmount],
                value: '0',
                contractStandard: ContractStandard.ERC20,
                chainId: lemonNetwork().chainId,
            },
        ],
        titleValues: { title: input.title },
    })
    if (response.result === TransactionResult.SUCCESS || response.result === TransactionResult.PENDING) {
        return { status: 'sent', txHash: response.data.txHash }
    }
    if (response.result === TransactionResult.CANCELLED) return { status: 'cancelled' }
    return { status: 'failed', message: 'error' in response ? response.error.message : 'unknown' }
}

/** Mint one badge to the user's Lemon wallet with the server's voucher. */
export async function mintBadge(input: {
    contract: string
    tokenId: number
    signature: string
    title: string
}): Promise<StablecoinPaymentResult> {
    const response = await callSmartContract({
        contracts: [
            {
                contractAddress: input.contract as `0x${string}`,
                functionName: 'mint',
                functionParams: [String(input.tokenId), input.signature],
                value: '0',
                chainId: lemonNetwork().chainId,
            },
        ],
        titleValues: { title: input.title },
    })
    if (response.result === TransactionResult.SUCCESS || response.result === TransactionResult.PENDING) {
        return { status: 'sent', txHash: response.data.txHash }
    }
    if (response.result === TransactionResult.CANCELLED) return { status: 'cancelled' }
    return { status: 'failed', message: 'error' in response ? response.error.message : 'unknown' }
}

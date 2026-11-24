'use client'

import { createPublicClient, createWalletClient, custom, http, type EIP1193Provider } from 'viem'
import { polygonAmoy } from 'viem/chains'
import { createSiweMessage } from 'viem/siwe'
import { api } from '@/lib/api'
import { lemonNetwork } from './chain'

/**
 * Test mode: on the Amoy testnet only, outside Lemon, a browser wallet such as MetaMask stands in
 * for Lemon's wallet, so the vaquita wallet can be tried on a preview link before Tribu is listed
 * in Lemon. On Polygon mainnet this module answers "not available" and nothing here runs.
 */

declare global {
    interface Window {
        ethereum?: EIP1193Provider
    }
}

export type TestCall = {
    contractAddress: `0x${string}`
    abi: readonly unknown[]
    functionName: string
    args: readonly unknown[]
}

export const testWalletEnabled = (): boolean =>
    typeof window !== 'undefined' &&
    !window.ReactNativeWebView &&
    !!window.ethereum &&
    lemonNetwork().key === 'polygon-amoy'

function provider(): EIP1193Provider {
    if (!window.ethereum) throw new Error('no browser wallet')
    return window.ethereum
}

async function onAmoy(): Promise<void> {
    const wallet = createWalletClient({ chain: polygonAmoy, transport: custom(provider()) })
    if ((await wallet.getChainId()) === polygonAmoy.id) return
    try {
        await wallet.switchChain({ id: polygonAmoy.id })
    } catch {
        await wallet.addChain({ chain: polygonAmoy })
        await wallet.switchChain({ id: polygonAmoy.id })
    }
}

export async function connectTestWallet(): Promise<`0x${string}`> {
    const wallet = createWalletClient({ chain: polygonAmoy, transport: custom(provider()) })
    const [address] = await wallet.requestAddresses()
    await onAmoy()
    return address
}

/** The same signed sign-in Lemon gives, from the browser wallet, so the server links it the same way. */
export async function testWalletProof(): Promise<{ wallet: string; message: string; signature: string }> {
    const address = await connectTestWallet()
    const { nonce } = await api.lemonNonce()
    const message = createSiweMessage({
        address,
        chainId: polygonAmoy.id,
        domain: window.location.host,
        nonce,
        uri: window.location.origin,
        version: '1',
        statement: 'Vincular esta billetera de prueba a Tribu',
    })
    const wallet = createWalletClient({ account: address, chain: polygonAmoy, transport: custom(provider()) })
    const signature = await wallet.signMessage({ account: address, message })
    return { wallet: address, message, signature }
}

/**
 * Sends the calls one after another, waiting for each to be mined: a deposit only succeeds after
 * the approval before it is on chain. Returns the last transaction's hash.
 */
export async function sendWithTestWallet(calls: TestCall[]): Promise<`0x${string}`> {
    const account = await connectTestWallet()
    const wallet = createWalletClient({ account, chain: polygonAmoy, transport: custom(provider()) })
    const reader = createPublicClient({ chain: polygonAmoy, transport: http() })
    let hash: `0x${string}` = '0x'
    for (const call of calls) {
        hash = await wallet.writeContract({
            address: call.contractAddress,
            abi: call.abi as never,
            functionName: call.functionName as never,
            args: call.args as never,
            account,
            chain: polygonAmoy,
        })
        const receipt = await reader.waitForTransactionReceipt({ hash })
        if (receipt.status !== 'success') throw new Error('transaction reverted')
    }
    return hash
}

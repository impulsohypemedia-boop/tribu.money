'use client'

import { callSmartContract, ContractStandard, TransactionResult } from '@lemoncash/mini-app-sdk'
import { lemonNetwork, type StablecoinConfig } from './chain'
import type { StablecoinPaymentResult } from './client'
import { erc20Abi, type Abi, type AbiFunction } from 'viem'
import { sendWithTestWallet, testWalletEnabled } from './test-wallet'
import { VAQUITA_ABI, VaquitaAction, vaquitaSalt, type VaquitaActionName } from './vaquita'

/**
 * The vaquita wallet's transactions, sent from the member's Lemon wallet. Lemon shows its own
 * confirmation screen for each one; nothing moves until the member confirms there. On the Amoy
 * testnet outside Lemon, a browser wallet stands in (`test-wallet.ts`).
 */

type ContractCall = {
    contractAddress: `0x${string}`
    functionName: string
    functionParams: unknown[]
    contractStandard?: ContractStandard
}

/** Lemon takes every parameter as a string; a browser wallet needs them typed by the ABI. */
export function typedArgs(abi: Abi, functionName: string, params: unknown[]): unknown[] {
    const item = abi.find((entry): entry is AbiFunction => entry.type === 'function' && entry.name === functionName)
    if (!item) throw new Error(`unknown function ${functionName}`)
    return params.map((param, i) => (item.inputs[i]?.type.startsWith('uint') ? BigInt(param as string) : param))
}

async function sendInTestMode(calls: ContractCall[]): Promise<StablecoinPaymentResult> {
    try {
        const txHash = await sendWithTestWallet(
            calls.map((call) => {
                const abi = (call.contractStandard === ContractStandard.ERC20 ? erc20Abi : VAQUITA_ABI) as Abi
                return {
                    contractAddress: call.contractAddress,
                    abi,
                    functionName: call.functionName,
                    args: typedArgs(abi, call.functionName, call.functionParams),
                }
            })
        )
        return { status: 'sent', txHash }
    } catch (error) {
        // Wallets report a rejected request with code 4001.
        if ((error as { code?: number }).code === 4001 || /reject|denied/i.test(String(error))) {
            return { status: 'cancelled' }
        }
        return { status: 'failed', message: error instanceof Error ? error.message : 'unknown' }
    }
}

async function send(calls: ContractCall[], title: string): Promise<StablecoinPaymentResult> {
    if (testWalletEnabled()) return sendInTestMode(calls)
    const chainId = lemonNetwork().chainId
    const response = await callSmartContract({
        contracts: calls.map((call) => ({ ...call, value: '0', chainId })),
        titleValues: { title },
    })
    if (response.result === TransactionResult.SUCCESS || response.result === TransactionResult.PENDING) {
        return { status: 'sent', txHash: response.data.txHash }
    }
    if (response.result === TransactionResult.CANCELLED) return { status: 'cancelled' }
    return { status: 'failed', message: 'error' in response ? response.error.message : 'unknown' }
}

export const createVaquitaWallet = (input: {
    contract: `0x${string}`
    potId: string
    token: StablecoinConfig
    earns: boolean
    members: string[]
    approvalsNeeded: number
    title: string
}) =>
    send(
        [
            {
                contractAddress: input.contract,
                functionName: 'createPot',
                functionParams: [
                    vaquitaSalt(input.potId),
                    input.token.address,
                    input.earns,
                    input.members,
                    String(input.approvalsNeeded),
                ],
            },
        ],
        input.title
    )

/** Approve exactly this amount and deposit it, in one confirmation. */
export const depositToVaquita = (input: {
    contract: `0x${string}`
    walletPotId: string
    token: StablecoinConfig
    units: bigint
    title: string
}) =>
    send(
        [
            {
                contractAddress: input.token.address,
                functionName: 'approve',
                functionParams: [input.contract, input.units.toString()],
                contractStandard: ContractStandard.ERC20,
            },
            {
                contractAddress: input.contract,
                functionName: 'deposit',
                functionParams: [input.walletPotId, input.units.toString()],
            },
        ],
        input.title
    )

export const withdrawFromVaquita = (input: {
    contract: `0x${string}`
    walletPotId: string
    units: bigint
    title: string
}) =>
    send(
        [
            {
                contractAddress: input.contract,
                functionName: 'withdraw',
                functionParams: [input.walletPotId, input.units.toString()],
            },
        ],
        input.title
    )

export const proposeFromVaquita = (input: {
    contract: `0x${string}`
    walletPotId: string
    action: VaquitaActionName
    target: string
    amount: bigint
    memo: `0x${string}`
    title: string
}) =>
    send(
        [
            {
                contractAddress: input.contract,
                functionName: 'propose',
                functionParams: [
                    input.walletPotId,
                    String(VaquitaAction[input.action]),
                    input.target,
                    input.amount.toString(),
                    input.memo,
                ],
            },
        ],
        input.title
    )

export const voteOnVaquita = (input: {
    contract: `0x${string}`
    walletPotId: string
    proposalId: number
    functionName: 'approve' | 'execute' | 'cancel'
    title: string
}) =>
    send(
        [
            {
                contractAddress: input.contract,
                functionName: input.functionName,
                functionParams: [input.walletPotId, String(input.proposalId)],
            },
        ],
        input.title
    )

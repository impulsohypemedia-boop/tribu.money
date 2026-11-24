'use client'

import { callSmartContract, ContractStandard, TransactionResult } from '@lemoncash/mini-app-sdk'
import { lemonNetwork, type StablecoinConfig } from './chain'
import type { StablecoinPaymentResult } from './client'
import { VaquitaAction, vaquitaSalt, type VaquitaActionName } from './vaquita'

/**
 * The vaquita wallet's transactions, sent from the member's Lemon wallet. Lemon shows its own
 * confirmation screen for each one; nothing moves until the member confirms there.
 */

type ContractCall = {
    contractAddress: `0x${string}`
    functionName: string
    functionParams: unknown[]
    contractStandard?: ContractStandard
}

async function send(calls: ContractCall[], title: string): Promise<StablecoinPaymentResult> {
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

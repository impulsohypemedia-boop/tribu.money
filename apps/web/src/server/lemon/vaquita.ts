import { availableStablecoins, lemonNetwork, sameAddress, type LemonNetwork } from '@/lib/lemon/chain'
import { VAQUITA_ABI, VaquitaAction, type VaquitaActionName } from '@/lib/lemon/vaquita'
import { chainClient } from './rpc'

/**
 * Reads a vaquita's wallet from the TribuVaquita contract. The chain is the only record of that
 * money, so nothing here is cached or copied into the database.
 */

/** The latest proposals shown; older ones are on the chain for anyone who looks. */
const PROPOSALS_SHOWN = 15

type Call = { functionName: string; args: readonly unknown[] }

/** The subset of viem's client used here, so tests can stand in for the chain. */
export interface VaquitaChain {
    multicall(input: {
        contracts: readonly (Call & { address: `0x${string}`; abi: typeof VAQUITA_ABI })[]
        allowFailure: false
    }): Promise<unknown[]>
}

export interface VaquitaWalletState {
    token: { symbol: 'USDC' | 'USDT'; address: string; decimals: number }
    approvalsNeeded: number
    totalUnits: bigint
    members: { wallet: string; partUnits: bigint }[]
    proposals: {
        id: number
        action: VaquitaActionName
        target: string
        amountUnits: bigint
        memo: string
        proposer: string
        status: 'open' | 'executed' | 'cancelled'
        approvedBy: string[]
    }[]
}

const ACTION_NAMES = Object.keys(VaquitaAction) as VaquitaActionName[]

export async function readVaquitaWallet(
    contract: `0x${string}`,
    walletPotId: `0x${string}`,
    chain: VaquitaChain = chainClient() as unknown as VaquitaChain,
    network: LemonNetwork = lemonNetwork()
): Promise<VaquitaWalletState | null> {
    const read = (calls: Call[]) =>
        calls.length === 0
            ? Promise.resolve([])
            : chain.multicall({
                  contracts: calls.map((call) => ({ ...call, address: contract, abi: VAQUITA_ABI })),
                  allowFailure: false,
              })

    const [pot, count] = (await read([
        { functionName: 'getPot', args: [walletPotId] },
        { functionName: 'proposalCount', args: [walletPotId] },
    ])) as [readonly [string, bigint, bigint, readonly string[]], bigint]
    const [tokenAddress, approvalsNeeded, total, wallets] = pot
    const token = availableStablecoins(network).find((candidate) => sameAddress(candidate.address, tokenAddress))
    if (!token) return null

    const parts = (await read(
        wallets.map((wallet) => ({ functionName: 'partOf', args: [walletPotId, wallet] }))
    )) as bigint[]

    const first = Math.max(0, Number(count) - PROPOSALS_SHOWN)
    const ids = Array.from({ length: Number(count) - first }, (_, i) => first + i)
    const proposals = (await read(
        ids.map((id) => ({ functionName: 'getProposal', args: [walletPotId, BigInt(id)] }))
    )) as [
        {
            action: number
            target: string
            amount: bigint
            memo: string
            proposer: string
            executed: boolean
            cancelled: boolean
        },
        bigint,
    ][]
    const approvals = (await read(
        ids.flatMap((id) =>
            wallets.map((wallet) => ({ functionName: 'hasApproved', args: [walletPotId, BigInt(id), wallet] }))
        )
    )) as boolean[]

    return {
        token: { symbol: token.symbol, address: token.address, decimals: token.decimals },
        approvalsNeeded: Number(approvalsNeeded),
        totalUnits: total,
        members: wallets.map((wallet, i) => ({ wallet: wallet.toLowerCase(), partUnits: parts[i] })),
        proposals: proposals
            .map(([proposal], index) => ({
                id: ids[index],
                action: ACTION_NAMES[proposal.action] ?? 'Pay',
                target: proposal.target.toLowerCase(),
                amountUnits: proposal.amount,
                memo: proposal.memo.toLowerCase(),
                proposer: proposal.proposer.toLowerCase(),
                status: proposal.executed
                    ? ('executed' as const)
                    : proposal.cancelled
                      ? ('cancelled' as const)
                      : ('open' as const),
                approvedBy: wallets
                    .filter((_, w) => approvals[index * wallets.length + w])
                    .map((wallet) => wallet.toLowerCase()),
            }))
            .reverse(),
    }
}

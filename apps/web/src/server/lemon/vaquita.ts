import { availableStablecoins, lemonNetwork, sameAddress, type LemonNetwork } from '@/lib/lemon/chain'
import type { Abi } from 'viem'
import { AAVE_POOL_ABI, aprBpsFromRay, VAQUITA_ABI, VaquitaAction, type VaquitaActionName } from '@/lib/lemon/vaquita'
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
        contracts: readonly (Call & { address: `0x${string}`; abi: Abi })[]
        allowFailure: false
    }): Promise<unknown[]>
}

export interface VaquitaWalletState {
    token: { symbol: 'USDC' | 'USDT'; address: string; decimals: number }
    /** Whether the money is in Aave, and Aave's current yearly rate when it could be read. */
    earns: boolean
    aprBps: number | null
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
    ])) as [readonly [string, boolean, bigint, bigint, readonly string[]], bigint]
    const [tokenAddress, earns, approvalsNeeded, total, wallets] = pot
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
        earns,
        aprBps: earns ? await readAaveRate(chain, contract, token.address) : null,
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

/** The rate is only shown, so a failed read leaves it out rather than failing the whole screen. */
async function readAaveRate(chain: VaquitaChain, contract: `0x${string}`, token: string): Promise<number | null> {
    try {
        const [pool] = (await chain.multicall({
            contracts: [{ address: contract, abi: VAQUITA_ABI, functionName: 'aavePool', args: [] }],
            allowFailure: false,
        })) as [`0x${string}`]
        const [reserve] = (await chain.multicall({
            contracts: [{ address: pool, abi: AAVE_POOL_ABI, functionName: 'getReserveData', args: [token] }],
            allowFailure: false,
        })) as [{ currentLiquidityRate: bigint }]
        return aprBpsFromRay(reserve.currentLiquidityRate)
    } catch {
        return null
    }
}

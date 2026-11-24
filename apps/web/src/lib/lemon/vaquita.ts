import { encodeAbiParameters, keccak256, parseAbi, stringToHex } from 'viem'
import { isAddress } from './chain'

/**
 * La vaquita as a real wallet: the pot's money held by the TribuVaquita contract
 * (`contracts/contracts/TribuVaquita.sol` at the repo root), shared by the browser and the server.
 *
 * The contract has no owner: members deposit, propose payments, approve them, and can always take
 * their own part out. Tribu only shows the state and asks Lemon to send the members' transactions.
 */

export const VAQUITA_ABI = parseAbi([
    'function potIdFor(address creator, bytes32 salt) pure returns (bytes32)',
    'function createPot(bytes32 salt, address token, address[] members, uint256 approvalsNeeded) returns (bytes32)',
    'function deposit(bytes32 potId, uint256 amount)',
    'function withdraw(bytes32 potId, uint256 amount)',
    'function leave(bytes32 potId)',
    'function propose(bytes32 potId, uint8 action, address target, uint256 amount, bytes32 memo) returns (uint256)',
    'function approve(bytes32 potId, uint256 proposalId)',
    'function execute(bytes32 potId, uint256 proposalId)',
    'function cancel(bytes32 potId, uint256 proposalId)',
    'function getPot(bytes32 potId) view returns (address token, uint256 approvalsNeeded, uint256 total, address[] members)',
    'function partOf(bytes32 potId, address member) view returns (uint256)',
    'function proposalCount(bytes32 potId) view returns (uint256)',
    'function getProposal(bytes32 potId, uint256 proposalId) view returns ((uint8 action, address target, uint256 amount, bytes32 memo, address proposer, bool executed, bool cancelled) proposal, uint256 approvals)',
    'function hasApproved(bytes32 potId, uint256 proposalId, address member) view returns (bool)',
])

/** Mirrors `TribuVaquita.Action`. */
export const VaquitaAction = { Pay: 0, AddMember: 1, RemoveMember: 2, SetApprovals: 3 } as const
export type VaquitaActionName = keyof typeof VaquitaAction

export const VAQUITA_MAX_MEMBERS = 20

/** The deployed contract, or null while it is not deployed: then the feature stays hidden. */
export function vaquitaContract(
    value: string | undefined = process.env.NEXT_PUBLIC_TRIBU_VAQUITA_ADDRESS
): `0x${string}` | null {
    return isAddress(value) ? value : null
}

/** The salt a pot's wallet is created with: one wallet per Tribu pot, per creator. */
export const vaquitaSalt = (potId: string): `0x${string}` => keccak256(stringToHex(`tribu-vaquita:${potId}`))

/** Same as the contract's `potIdFor`, so the app knows the id before the transaction is mined. */
export function vaquitaWalletId(creator: `0x${string}`, potId: string): `0x${string}` {
    return keccak256(
        encodeAbiParameters([{ type: 'address' }, { type: 'bytes32' }], [creator, vaquitaSalt(potId)])
    ).toLowerCase() as `0x${string}`
}

/** A simple majority: 1 of 1, 2 of 2, 2 of 3, 3 of 4, 3 of 5. */
export const majorityOf = (members: number): number => Math.floor(members / 2) + 1

/**
 * A typed dollar amount ("12,5", "12.50") to token base units, or null when it is not a positive
 * amount with at most `decimals` decimals. Commas are read as the decimal mark, as people type
 * them in Argentina; thousands separators are not accepted.
 */
export function parseTokenAmount(input: string, decimals: number): bigint | null {
    const text = input.trim().replace(',', '.')
    const match = /^(\d{1,12})(?:\.(\d*))?$/.exec(text)
    if (!match) return null
    const fraction = match[2] ?? ''
    if (fraction.length > decimals) return null
    const units = BigInt(match[1]) * 10n ** BigInt(decimals) + BigInt(fraction.padEnd(decimals, '0') || '0')
    return units > 0n ? units : null
}

/** A random memo for a payment, so its description can live off-chain. */
export function randomMemo(): `0x${string}` {
    const bytes = new Uint8Array(32)
    crypto.getRandomValues(bytes)
    return `0x${Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')}`
}

export const isBytes32 = (value: unknown): value is `0x${string}` =>
    typeof value === 'string' && /^0x[0-9a-f]{64}$/.test(value)

/**
 * Token units as dollars for display, rounded down to the cent: a member is never shown more than
 * they can take out. Exact up to 2^53 cents, far past any pot.
 */
export function formatUsd(units: bigint, decimals: number, locale: string): string {
    const cents = decimals >= 2 ? units / 10n ** BigInt(decimals - 2) : units * 10n ** BigInt(2 - decimals)
    return new Intl.NumberFormat(locale, {
        style: 'currency',
        currency: 'USD',
        currencyDisplay: 'narrowSymbol',
    }).format(Number(cents) / 100)
}

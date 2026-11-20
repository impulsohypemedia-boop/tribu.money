/**
 * Where a member asks to be paid outside Lemon: a stablecoin, a network and an address.
 *
 * Tribu only shows these to the people who owe the member; it never sends a payment with them.
 * The address check catches typos and pastes into the wrong field, not ownership.
 */

export const PAYOUT_TOKENS = ['USDT', 'USDC'] as const
export type PayoutToken = (typeof PAYOUT_TOKENS)[number]

type AddressFormat = 'evm' | 'tron'

export const PAYOUT_NETWORKS = {
    polygon: { label: 'Polygon', format: 'evm' },
    tron: { label: 'Tron', format: 'tron' },
    ethereum: { label: 'Ethereum', format: 'evm' },
    arbitrum: { label: 'Arbitrum', format: 'evm' },
    base: { label: 'Base', format: 'evm' },
    bnb: { label: 'BNB Chain', format: 'evm' },
} as const satisfies Record<string, { label: string; format: AddressFormat }>

export type PayoutNetwork = keyof typeof PAYOUT_NETWORKS
export const PAYOUT_NETWORK_KEYS = Object.keys(PAYOUT_NETWORKS) as PayoutNetwork[]
export const DEFAULT_PAYOUT_NETWORK: PayoutNetwork = 'polygon'

export const isPayoutToken = (value: unknown): value is PayoutToken =>
    typeof value === 'string' && (PAYOUT_TOKENS as readonly string[]).includes(value)

export const isPayoutNetwork = (value: unknown): value is PayoutNetwork =>
    typeof value === 'string' && Object.hasOwn(PAYOUT_NETWORKS, value)

const EVM_ADDRESS = /^0x[0-9a-fA-F]{40}$/
const TRON_ADDRESS = /^T[1-9A-HJ-NP-Za-km-z]{33}$/

/** The address as it should be stored, or null when it does not fit the network. */
export function normalizePayoutAddress(network: PayoutNetwork, raw: string): string | null {
    const address = raw.trim()
    if (PAYOUT_NETWORKS[network].format === 'tron') return TRON_ADDRESS.test(address) ? address : null
    return EVM_ADDRESS.test(address) ? address.toLowerCase() : null
}

/** `0x1234…abcd`: enough to recognise an address without letting it fill the row. */
export const shortAddress = (address: string): string =>
    address.length <= 14 ? address : `${address.slice(0, 6)}…${address.slice(-4)}`

export interface MemberPayout {
    token: PayoutToken
    network: PayoutNetwork
    address: string
}

/** A member's payout details, or null unless all three parts are present and valid. */
export function payoutOf(member: {
    payoutToken?: string | null
    payoutNetwork?: string | null
    payoutAddress?: string | null
}): MemberPayout | null {
    const { payoutToken: token, payoutNetwork: network, payoutAddress: address } = member
    if (!isPayoutToken(token) || !isPayoutNetwork(network) || !address) return null
    return { token, network, address }
}

/**
 * Where Tribu settles debts: one EVM chain, two dollar stablecoins.
 *
 * Shared by the browser (what the Lemon SDK is asked to send) and the server (what a recorded
 * payment is checked against), so the two can never disagree about a token address or its decimals.
 *
 * `NEXT_PUBLIC_LEMON_NETWORK=polygon-amoy` switches to the testnet. Amoy has Circle's test USDC but
 * no official USDT, so the testnet USDT address must be supplied explicitly or USDT is not offered.
 */

export type StablecoinSymbol = 'USDC' | 'USDT'
export const STABLECOINS: readonly StablecoinSymbol[] = ['USDC', 'USDT']

export interface StablecoinConfig {
    symbol: StablecoinSymbol
    address: `0x${string}`
    decimals: number
}

export interface LemonNetwork {
    key: 'polygon' | 'polygon-amoy'
    /** The Lemon SDK `ChainId` value, which is also the EVM chain id. */
    chainId: number
    name: string
    explorerTxUrl: (hash: string) => string
    tokens: Partial<Record<StablecoinSymbol, StablecoinConfig>>
}

const POLYGON: LemonNetwork = {
    key: 'polygon',
    chainId: 137,
    name: 'Polygon',
    explorerTxUrl: (hash) => `https://polygonscan.com/tx/${hash}`,
    tokens: {
        // Native Circle USDC, not the bridged USDC.e.
        USDC: { symbol: 'USDC', address: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359', decimals: 6 },
        USDT: { symbol: 'USDT', address: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F', decimals: 6 },
    },
}

function amoy(usdtAddress: string | undefined): LemonNetwork {
    return {
        key: 'polygon-amoy',
        chainId: 80002,
        name: 'Polygon Amoy',
        explorerTxUrl: (hash) => `https://amoy.polygonscan.com/tx/${hash}`,
        tokens: {
            USDC: { symbol: 'USDC', address: '0x41E94Eb019C0762f9Bfcf9Fb1E58725BfB0e7582', decimals: 6 },
            ...(isAddress(usdtAddress) ? { USDT: { symbol: 'USDT', address: usdtAddress, decimals: 6 } } : {}),
        },
    }
}

const ADDRESS = /^0x[0-9a-fA-F]{40}$/

export function isAddress(value: unknown): value is `0x${string}` {
    return typeof value === 'string' && ADDRESS.test(value)
}

export function lemonNetwork(
    network: string | undefined = process.env.NEXT_PUBLIC_LEMON_NETWORK,
    amoyUsdt: string | undefined = process.env.NEXT_PUBLIC_LEMON_AMOY_USDT_ADDRESS
): LemonNetwork {
    return network === 'polygon-amoy' ? amoy(amoyUsdt) : POLYGON
}

export function availableStablecoins(network: LemonNetwork = lemonNetwork()): StablecoinConfig[] {
    return STABLECOINS.flatMap((symbol) => network.tokens[symbol] ?? [])
}

/** Addresses compare case-insensitively: checksummed and lowercase spellings are the same account. */
export const sameAddress = (a: string | null | undefined, b: string | null | undefined): boolean =>
    !!a && !!b && a.toLowerCase() === b.toLowerCase()

/**
 * USD minor units (cents) to token base units. Both stablecoins are treated as exactly one dollar;
 * a depeg is a risk Tribu states, not one it prices.
 */
export function usdCentsToTokenUnits(cents: bigint, token: StablecoinConfig): bigint {
    if (cents < 0n) throw new RangeError('amount must not be negative')
    if (token.decimals < 2) throw new RangeError('token has fewer decimals than cents')
    return cents * 10n ** BigInt(token.decimals - 2)
}

/** Token base units as a plain decimal string for display ("12.5" for 12_500_000 at 6 decimals). */
export function formatTokenUnits(units: bigint, decimals: number): string {
    const negative = units < 0n
    const abs = negative ? -units : units
    const base = 10n ** BigInt(decimals)
    const whole = abs / base
    const fraction = (abs % base).toString().padStart(decimals, '0').replace(/0+$/, '')
    return `${negative ? '-' : ''}${whole}${fraction ? `.${fraction}` : ''}`
}

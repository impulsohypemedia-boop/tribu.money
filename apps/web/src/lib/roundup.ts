/**
 * Redondeo al pozo: a payment is rounded up to the next step, and the difference goes into the
 * tribu's pot. Amounts are minor units as strings; nothing here goes through Number.
 */

/** Steps offered, in whole currency units. Pesos and similar get the bigger ones by default. */
export const ROUND_UP_UNITS = [1, 10, 100, 1000] as const
export type RoundUpUnit = (typeof ROUND_UP_UNITS)[number]

const BIG_UNIT_CURRENCIES = new Set(['ARS', 'CLP', 'COP', 'PYG', 'UYU', 'MXN', 'CRC', 'JPY', 'KRW', 'HUF', 'ISK'])

export function defaultRoundUpUnit(currency: string): RoundUpUnit {
    if (currency === 'ARS' || currency === 'CLP' || currency === 'COP' || currency === 'PYG') return 1000
    return BIG_UNIT_CURRENCIES.has(currency) ? 100 : 1
}

/** One step in minor units: 10 units of a 2-decimal currency is 1000. */
export const unitToMinor = (unit: RoundUpUnit, decimals: number): bigint => BigInt(unit) * 10n ** BigInt(decimals)

/** What rounding `amountMinor` up to the next multiple of `stepMinor` adds. "0" when it is already one. */
export function roundUpDifference(amountMinor: string, stepMinor: bigint): string {
    const amount = BigInt(amountMinor)
    if (amount <= 0n || stepMinor <= 0n) return '0'
    const rest = amount % stepMinor
    return rest === 0n ? '0' : (stepMinor - rest).toString()
}

const storageKey = (slug: string) => `tribu:redondeo:${slug}`

/** This phone's choice for a room: the step it rounds to, or null when it does not round. */
export function rememberedRoundUp(slug: string): RoundUpUnit | null {
    try {
        const value = Number(window.localStorage.getItem(storageKey(slug)))
        return (ROUND_UP_UNITS as readonly number[]).includes(value) ? (value as RoundUpUnit) : null
    } catch {
        return null
    }
}

export function rememberRoundUp(slug: string, unit: RoundUpUnit | null): void {
    try {
        if (unit === null) window.localStorage.removeItem(storageKey(slug))
        else window.localStorage.setItem(storageKey(slug), String(unit))
    } catch {
        // Private mode or blocked storage: the switch still works for this payment.
    }
}

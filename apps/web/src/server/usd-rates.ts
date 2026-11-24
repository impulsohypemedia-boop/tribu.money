/**
 * Indicative dollar values for the patrimonio screen: US dollars per one unit of each currency.
 *
 * Two free sources without keys. Pesos use the "dólar cripto" quote from dolarapi.com, because a
 * tribu's dollars are digital dollars (USDC/USDT) and that is the rate Argentines get for them.
 * Every other currency comes from open.er-api.com's daily table. Either one failing falls back to
 * the static table in `money.ts`, and the response says which source priced each currency.
 *
 * This only labels a screen; it never prices an expense or a payment (that is `fx.ts`).
 */
import { STATIC_USD_PER_UNIT } from '@/server/money'

const PESO_ENDPOINT = 'https://dolarapi.com/v1/dolares/cripto'
const TABLE_ENDPOINT = 'https://open.er-api.com/v6/latest/USD'
const TTL_MS = 60 * 60 * 1000
const FAILURE_BACKOFF_MS = 60 * 1000
const FETCH_TIMEOUT_MS = 5000

export type UsdRateSource = 'dolar-cripto' | 'open-er-api' | 'static'

export interface UsdRateTable {
    /** US dollars per one unit, as plain decimal strings. */
    rates: Record<string, string>
    sources: Record<string, UsdRateSource>
    /** Pesos per dollar at the dólar cripto quote, when it was reachable. */
    arsPerUsd: string | null
    fetchedAt: string
}

interface Cached {
    table: UsdRateTable
    expiresAt: number
}

let cached: Cached | null = null
let inFlight: Promise<UsdRateTable> | null = null

/** 1/unitsPerUsd as a plain decimal string (no exponent), or null for a non-positive input. */
export function usdPerUnit(unitsPerUsd: unknown): string | null {
    const value = typeof unitsPerUsd === 'number' ? unitsPerUsd : Number(unitsPerUsd)
    if (!Number.isFinite(value) || value <= 0) return null
    const inverse = 1 / value
    if (!Number.isFinite(inverse) || inverse <= 0) return null
    return inverse.toFixed(15).replace(/0+$/, '').replace(/\.$/, '') || null
}

async function fetchJson(url: string): Promise<unknown> {
    const response = await fetch(url, {
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
        headers: { accept: 'application/json' },
        cache: 'no-store',
    })
    if (!response.ok) throw new Error(`${url} answered ${response.status}`)
    return response.json()
}

/** Pure: builds the table from whatever the two sources answered (null for a failed source). */
export function buildUsdRateTable(peso: unknown, table: unknown, now = new Date()): UsdRateTable {
    const rates: Record<string, string> = {}
    const sources: Record<string, UsdRateSource> = {}
    for (const [code, usd] of Object.entries(STATIC_USD_PER_UNIT)) {
        rates[code] = String(usd)
        sources[code] = 'static'
    }

    const tableRates =
        table && typeof table === 'object' && (table as { result?: unknown }).result === 'success'
            ? (table as { rates?: unknown }).rates
            : null
    if (tableRates && typeof tableRates === 'object') {
        for (const [code, units] of Object.entries(tableRates as Record<string, unknown>)) {
            if (!/^[A-Z]{3}$/.test(code)) continue
            const usd = usdPerUnit(units)
            if (!usd) continue
            rates[code] = usd
            sources[code] = 'open-er-api'
        }
    }

    let arsPerUsd: string | null = null
    const venta = peso && typeof peso === 'object' ? (peso as { venta?: unknown }).venta : undefined
    const pesoUsd = usdPerUnit(venta)
    if (pesoUsd) {
        rates.ARS = pesoUsd
        sources.ARS = 'dolar-cripto'
        arsPerUsd = String(venta)
    }

    rates.USD = '1'
    sources.USD = 'static'
    return { rates, sources, arsPerUsd, fetchedAt: now.toISOString() }
}

async function refresh(): Promise<UsdRateTable> {
    const [peso, table] = await Promise.all([
        fetchJson(PESO_ENDPOINT).catch(() => null),
        fetchJson(TABLE_ENDPOINT).catch(() => null),
    ])
    const built = buildUsdRateTable(peso, table)
    const live = peso !== null || table !== null
    cached = { table: built, expiresAt: Date.now() + (live ? TTL_MS : FAILURE_BACKOFF_MS) }
    return built
}

export async function getUsdRates(): Promise<UsdRateTable> {
    if (cached && cached.expiresAt > Date.now()) return cached.table
    inFlight ??= refresh().finally(() => {
        inFlight = null
    })
    return inFlight
}

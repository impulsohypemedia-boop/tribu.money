/**
 * Patrimonio: how much money your tribus hold together, in dollars.
 *
 * Today a tribu's money is what sits in its vaquitas and pozos (in the keeper's account). This
 * file adds those up across every room the device remembers, converts each currency to US
 * dollars at today's indicative rate, and rebuilds how the total moved month by month from the
 * contributions and the expenses the pots paid. The idea of valuing holdings in one currency and
 * replaying activity into a history comes from Ghostfolio (AGPL-3.0); no code was taken from it.
 *
 * All amounts are minor-unit strings and the math is BigInt. Rates are decimal strings: US
 * dollars per one unit of the currency.
 */
import type { MyRoom } from './my-overview'
import { localMonthKey, shiftLocalMonth } from './month-summary'
import { potSummary } from './pots'

/** Codes worth exactly one dollar for this view, whatever the rate table says. */
export const DOLLAR_CODES: ReadonlySet<string> = new Set(['USD', 'USDC', 'USDT', 'DAI', 'USDS'])

/** US dollars per one unit of each currency, as decimal strings. */
export type UsdRates = Readonly<Record<string, string>>

const RATE_SCALE_DIGITS = 12
const RATE_SCALE = 10n ** BigInt(RATE_SCALE_DIGITS)
const RATE_PATTERN = /^\d+(?:\.\d+)?$/

/** A rate as an integer scaled by 10^12, or null when it is not a plain positive decimal. */
export function scaledRate(rate: string | undefined): bigint | null {
    if (!rate || !RATE_PATTERN.test(rate)) return null
    const [whole, fraction = ''] = rate.split('.')
    const scaled = BigInt(whole + fraction.slice(0, RATE_SCALE_DIGITS).padEnd(RATE_SCALE_DIGITS, '0'))
    return scaled > 0n ? scaled : null
}

const divRound = (numerator: bigint, denominator: bigint) => {
    const negative = numerator < 0n
    const magnitude = negative ? -numerator : numerator
    const rounded = (magnitude * 2n + denominator) / (denominator * 2n)
    return negative ? -rounded : rounded
}

/** Minor units of `currency` to US cents, rounded half away from zero. Null without a rate. */
export function toUsdCents(minor: bigint, currency: string, decimals: number, rates: UsdRates): bigint | null {
    const rate = DOLLAR_CODES.has(currency) ? RATE_SCALE : scaledRate(rates[currency])
    if (rate === null) return null
    return divRound(minor * rate * 100n, 10n ** BigInt(decimals) * RATE_SCALE)
}

export interface PatrimonyPot {
    potId: string
    name: string
    heldMinor: string
}

export interface PatrimonyRoom {
    slug: string
    name: string
    kind: string
    currency: string
    heldMinor: string
    /** Null when there is no rate for the currency. */
    usdCents: string | null
    pots: PatrimonyPot[]
}

export interface PatrimonyCurrency {
    currency: string
    heldMinor: string
    usdCents: string | null
}

export interface PatrimonyPoint {
    /** YYYY-MM; the value is what was held at the end of that month (or now, for this month). */
    month: string
    usdCents: string
}

export interface Patrimony {
    totalUsdCents: string
    /** Currencies left out of the dollar total because no rate is known. */
    unpriced: string[]
    byCurrency: PatrimonyCurrency[]
    /** Rooms with at least one open pot, most money first. */
    byRoom: PatrimonyRoom[]
    /** Oldest first, ending this month. Empty when nothing ever went into a pot. */
    history: PatrimonyPoint[]
}

interface Movement {
    month: string
    currency: string
    minor: bigint
}

const byUsdDesc = (a: { usdCents: string | null }, b: { usdCents: string | null }) => {
    const x = a.usdCents === null ? -1n : BigInt(a.usdCents)
    const y = b.usdCents === null ? -1n : BigInt(b.usdCents)
    return x > y ? -1 : x < y ? 1 : 0
}

/**
 * @param decimalsOf how many minor digits a currency has (the currency catalog).
 * @param months how many months of history to return at most, this one included.
 */
export function patrimony(
    rooms: readonly MyRoom[],
    rates: UsdRates,
    decimalsOf: (currency: string) => number,
    now = new Date(),
    months = 12
): Patrimony {
    const byRoom: PatrimonyRoom[] = []
    const heldByCurrency = new Map<string, bigint>()
    const movements: Movement[] = []

    for (const room of rooms) {
        const currency = room.state.room.currency
        const pots: PatrimonyPot[] = []
        let roomHeld = 0n
        for (const pot of room.state.pots ?? []) {
            // A closed pot handed its money back; it no longer belongs to the tribu.
            if (pot.closedAt) continue
            const summary = potSummary(pot, room.state, now)
            const held = BigInt(summary.heldMinor)
            roomHeld += held
            pots.push({ potId: pot.id, name: pot.name, heldMinor: held.toString() })
            for (const contribution of pot.contributions)
                movements.push({
                    month: localMonthKey(new Date(contribution.createdAt)),
                    currency,
                    minor: BigInt(contribution.amountMinor),
                })
            const paid = new Set(summary.expenseIds)
            for (const expense of room.state.expenses)
                if (paid.has(expense.id))
                    movements.push({
                        month: localMonthKey(new Date(expense.date)),
                        currency,
                        minor: -BigInt(expense.baseAmountMinor),
                    })
        }
        if (pots.length === 0) continue
        heldByCurrency.set(currency, (heldByCurrency.get(currency) ?? 0n) + roomHeld)
        const usd = toUsdCents(roomHeld, currency, decimalsOf(currency), rates)
        byRoom.push({
            slug: room.slug,
            name: room.state.room.name,
            kind: room.state.room.kind ?? 'tribu',
            currency,
            heldMinor: roomHeld.toString(),
            usdCents: usd?.toString() ?? null,
            pots,
        })
    }

    let total = 0n
    const unpriced: string[] = []
    const byCurrency: PatrimonyCurrency[] = []
    for (const [currency, held] of heldByCurrency) {
        const usd = toUsdCents(held, currency, decimalsOf(currency), rates)
        if (usd === null) unpriced.push(currency)
        else total += usd
        byCurrency.push({ currency, heldMinor: held.toString(), usdCents: usd?.toString() ?? null })
    }

    return {
        totalUsdCents: total.toString(),
        unpriced: unpriced.sort(),
        byCurrency: byCurrency.sort(byUsdDesc),
        byRoom: byRoom.sort(byUsdDesc),
        history: monthlyHistory(movements, rates, decimalsOf, localMonthKey(now), months),
    }
}

/**
 * Month-end totals, every month valued at today's rate. Using today's rate for the past keeps
 * the line about what the tribu put in and spent, not about how the peso moved.
 */
function monthlyHistory(
    movements: readonly Movement[],
    rates: UsdRates,
    decimalsOf: (currency: string) => number,
    thisMonth: string,
    months: number
): PatrimonyPoint[] {
    if (movements.length === 0) return []
    const firstMonth = movements.reduce((first, m) => (m.month < first ? m.month : first), thisMonth)
    let start = shiftLocalMonth(thisMonth, -(months - 1))
    if (firstMonth > start) start = firstMonth
    // One point alone draws no line: start at least a month before this one.
    if (start === thisMonth) start = shiftLocalMonth(thisMonth, -1)

    const running = new Map<string, bigint>()
    const sorted = [...movements].sort((a, b) => (a.month < b.month ? -1 : a.month > b.month ? 1 : 0))
    let index = 0
    const points: PatrimonyPoint[] = []
    for (let month = start; month <= thisMonth; month = shiftLocalMonth(month, 1)) {
        while (index < sorted.length && sorted[index].month <= month) {
            const m = sorted[index++]
            running.set(m.currency, (running.get(m.currency) ?? 0n) + m.minor)
        }
        let usd = 0n
        for (const [currency, held] of running) usd += toUsdCents(held, currency, decimalsOf(currency), rates) ?? 0n
        points.push({ month, usdCents: usd.toString() })
    }
    return points
}

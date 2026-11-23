/**
 * La vaquita que rinde: an estimate of what the pot's money earned while it sat in the keeper's
 * account at a yearly rate the tribu sets. Tribu never moves or holds the money, so this is a
 * figure to show, never a balance: it is not added to the pot or to anyone's balance.
 *
 * Simple interest on what was in the pot over time, never on a negative amount, rounded down.
 */
import type { ApiExpense, ApiPot } from './api-types'

const YEAR_MS = 365n * 24n * 60n * 60n * 1000n
const BPS = 10_000n

/** Highest rate the form accepts: 20% a year. Anything above that is a typo or a promise nobody keeps. */
export const MAX_YIELD_APR_BPS = 2000

export interface PotYield {
    /** Earned so far, room-currency minor units. */
    earnedMinor: string
    /** What the money in the pot now would earn in a year at the same rate. */
    nextYearMinor: string
}

export function potYield(
    pot: Pick<ApiPot, 'id' | 'keeperId' | 'contributions'> & { yieldAprBps?: number | null },
    expenses: readonly Pick<ApiExpense, 'potId' | 'paidById' | 'baseAmountMinor' | 'createdAt'>[],
    now = new Date()
): PotYield | null {
    const bps = BigInt(pot.yieldAprBps ?? 0)
    if (bps <= 0n) return null
    const moves = [
        ...pot.contributions.map((c) => ({ at: Date.parse(c.createdAt), delta: BigInt(c.amountMinor) })),
        ...expenses
            .filter((expense) => expense.potId === pot.id && expense.paidById === pot.keeperId)
            .map((expense) => ({ at: Date.parse(expense.createdAt), delta: -BigInt(expense.baseAmountMinor) })),
    ].sort((a, b) => a.at - b.at)

    const end = now.getTime()
    let held = 0n
    let weighted = 0n // minor-units × milliseconds
    for (let i = 0; i < moves.length; i++) {
        held += moves[i].delta
        const until = Math.min(i + 1 < moves.length ? moves[i + 1].at : end, end)
        const span = BigInt(Math.max(0, until - moves[i].at))
        if (held > 0n) weighted += held * span
    }
    const positiveHeld = held > 0n ? held : 0n
    return {
        earnedMinor: ((weighted * bps) / (BPS * YEAR_MS)).toString(),
        nextYearMinor: ((positiveHeld * bps) / BPS).toString(),
    }
}

/** "4,5" → 450. Null when it is not a rate the form takes. */
export function parseAprPercent(input: string): number | null {
    const match = input
        .trim()
        .replace(',', '.')
        .match(/^(\d{1,2})(?:\.(\d{1,2}))?$/)
    if (!match) return null
    const bps = Number(match[1]) * 100 + Number((match[2] ?? '').padEnd(2, '0'))
    return bps > 0 && bps <= MAX_YIELD_APR_BPS ? bps : null
}

export const formatAprPercent = (bps: number, locale: string) =>
    new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(bps / 100)

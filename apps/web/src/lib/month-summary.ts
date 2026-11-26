/**
 * One calendar month of a tribu, for the "Resumen del mes" card: what was spent, on what, and
 * what each person put in next to what their share was. All amounts are room-currency minor
 * units as strings, the same as the rest of the wire; nothing here goes through Number.
 *
 * Months follow the viewer's own calendar (the device time zone), like the day headings in the
 * expense list.
 */
import type { RoomState } from './api-types'
import { expenseCategoryOf } from './expense-category'

export const localMonthKey = (date: Date): string =>
    `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`

export const shiftLocalMonth = (key: string, delta: number): string => {
    const [year, month] = key.split('-').map(Number)
    return localMonthKey(new Date(year, month - 1 + delta, 1))
}

export interface MonthMemberLine {
    memberId: string
    /** What this person paid for the tribu in the month. */
    paidMinor: string
    /** Their part of the month's expenses. */
    shareMinor: string
}

export interface MonthSummary {
    month: string
    totalMinor: string
    expenseCount: number
    /** Biggest first. An expense with no category picked counts in the one its description suggests. */
    categories: { category: string; amountMinor: string }[]
    /** People who paid or had a share, most paid first. */
    members: MonthMemberLine[]
    biggestExpenseId: string | null
    previousTotalMinor: string
    /**
     * Expenses loaded in another currency, summed per currency: what was paid in that currency and
     * what it counts for in the room's currency (each expense at the rate it was saved with). The
     * total above is always in the room's currency; this is what lets the screen say so.
     */
    converted: { currency: string; amountMinor: string; baseAmountMinor: string }[]
}

const sumBy = (map: Map<string, bigint>, key: string, amount: bigint) => map.set(key, (map.get(key) ?? 0n) + amount)

const desc = (a: bigint, b: bigint) => (a === b ? 0 : a > b ? -1 : 1)

export function monthSummary(state: Pick<RoomState, 'expenses' | 'room'>, month: string): MonthSummary {
    const inMonth = (key: string) => state.expenses.filter((expense) => localMonthKey(new Date(expense.date)) === key)
    const expenses = inMonth(month)
    const categories = new Map<string, bigint>()
    const paid = new Map<string, bigint>()
    const shares = new Map<string, bigint>()
    let total = 0n
    let biggest: { id: string; amount: bigint } | null = null
    const converted = new Map<string, { amount: bigint; base: bigint }>()

    for (const expense of expenses) {
        const amount = BigInt(expense.baseAmountMinor)
        total += amount
        sumBy(categories, expenseCategoryOf(expense), amount)
        sumBy(paid, expense.paidById, amount)
        for (const share of expense.shares) sumBy(shares, share.memberId, BigInt(share.amountMinor))
        if (!biggest || amount > biggest.amount) biggest = { id: expense.id, amount }
        if (expense.currency !== state.room.currency) {
            const line = converted.get(expense.currency) ?? { amount: 0n, base: 0n }
            line.amount += BigInt(expense.amountMinor)
            line.base += amount
            converted.set(expense.currency, line)
        }
    }

    const memberIds = new Set([...paid.keys(), ...shares.keys()])
    const members = [...memberIds]
        .map((memberId) => ({ memberId, paid: paid.get(memberId) ?? 0n, share: shares.get(memberId) ?? 0n }))
        .sort((a, b) => desc(a.paid, b.paid) || desc(a.share, b.share) || a.memberId.localeCompare(b.memberId))
        .map(({ memberId, paid, share }) => ({ memberId, paidMinor: paid.toString(), shareMinor: share.toString() }))

    const previousTotal = inMonth(shiftLocalMonth(month, -1)).reduce(
        (sum, expense) => sum + BigInt(expense.baseAmountMinor),
        0n
    )

    return {
        month,
        totalMinor: total.toString(),
        expenseCount: expenses.length,
        categories: [...categories.entries()]
            .sort((a, b) => desc(a[1], b[1]) || a[0].localeCompare(b[0]))
            .map(([category, amount]) => ({ category, amountMinor: amount.toString() })),
        members,
        biggestExpenseId: biggest?.id ?? null,
        previousTotalMinor: previousTotal.toString(),
        converted: [...converted.entries()]
            .sort((a, b) => desc(a[1].base, b[1].base) || a[0].localeCompare(b[0]))
            .map(([currency, line]) => ({
                currency,
                amountMinor: line.amount.toString(),
                baseAmountMinor: line.base.toString(),
            })),
    }
}

/** Months that have at least one expense, oldest first. */
export const monthsWithExpenses = (state: Pick<RoomState, 'expenses'>): string[] =>
    [...new Set(state.expenses.map((expense) => localMonthKey(new Date(expense.date))))].sort()

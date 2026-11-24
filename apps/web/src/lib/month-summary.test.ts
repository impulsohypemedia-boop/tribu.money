import { describe, expect, it } from 'vitest'
import type { ApiExpense } from './api-types'
import { localMonthKey, monthSummary, monthsWithExpenses, shiftLocalMonth } from './month-summary'

const at = (year: number, month: number, day: number) => new Date(year, month - 1, day, 12).toISOString()

const expense = (
    id: string,
    date: string,
    amount: string,
    paidById: string,
    shares: [string, string][],
    category: string | null = null
): ApiExpense =>
    ({
        id,
        description: id === 'netflix' ? 'Netflix' : '',
        date,
        baseAmountMinor: amount,
        amountMinor: amount,
        paidById,
        category,
        shares: shares.map(([memberId, amountMinor]) => ({
            memberId,
            amountMinor,
            enteredAmountMinor: null,
            splitWeight: null,
        })),
    }) as unknown as ApiExpense

const expenses = [
    expense(
        'rent',
        at(2026, 11, 1),
        '90000',
        'ana',
        [
            ['ana', '45000'],
            ['bea', '45000'],
        ],
        'home-bills'
    ),
    expense(
        'super',
        at(2026, 11, 8),
        '30000',
        'bea',
        [
            ['ana', '15000'],
            ['bea', '15000'],
        ],
        'food-drink'
    ),
    expense('netflix', at(2026, 11, 20), '1200', 'ana', [
        ['ana', '600'],
        ['bea', '600'],
    ]),
    expense(
        'oct',
        at(2026, 10, 3),
        '50000',
        'ana',
        [
            ['ana', '25000'],
            ['bea', '25000'],
        ],
        'home-bills'
    ),
]

describe('monthSummary', () => {
    const november = monthSummary({ expenses }, '2026-11')

    it('adds up the month and compares it with the one before', () => {
        expect(november.totalMinor).toBe('121200')
        expect(november.expenseCount).toBe(3)
        expect(november.previousTotalMinor).toBe('50000')
        expect(november.biggestExpenseId).toBe('rent')
    })

    it('groups categories biggest first, blank ones as other', () => {
        expect(november.categories).toEqual([
            { category: 'home-bills', amountMinor: '90000' },
            { category: 'food-drink', amountMinor: '30000' },
            { category: 'other', amountMinor: '1200' },
        ])
    })

    it('shows what each person paid next to their share, and the shares add up to the total', () => {
        expect(november.members).toEqual([
            { memberId: 'ana', paidMinor: '91200', shareMinor: '60600' },
            { memberId: 'bea', paidMinor: '30000', shareMinor: '60600' },
        ])
        const shares = november.members.reduce((sum, line) => sum + BigInt(line.shareMinor), 0n)
        expect(shares.toString()).toBe(november.totalMinor)
    })

    it('is empty, not broken, for a quiet month', () => {
        const quiet = monthSummary({ expenses }, '2026-09')
        expect(quiet).toMatchObject({ totalMinor: '0', expenseCount: 0, categories: [], members: [] })
        expect(quiet.biggestExpenseId).toBeNull()
    })
})

describe('month keys', () => {
    it('shifts across years', () => {
        expect(shiftLocalMonth('2026-01', -1)).toBe('2025-12')
        expect(shiftLocalMonth('2026-12', 1)).toBe('2027-01')
    })

    it('lists the months that have expenses, oldest first', () => {
        expect(monthsWithExpenses({ expenses })).toEqual(['2026-10', '2026-11'])
        expect(localMonthKey(new Date(2026, 10, 30))).toBe('2026-11')
    })
})

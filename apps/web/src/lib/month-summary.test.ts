import { describe, expect, it } from 'vitest'
import type { ApiExpense, RoomState } from './api-types'
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
        currency: 'ARS',
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

const room = { currency: 'ARS' } as RoomState['room']

describe('monthSummary', () => {
    const november = monthSummary({ expenses, room }, '2026-11')

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

    it('has nothing converted when every expense is in the room currency', () => {
        expect(november.converted).toEqual([])
    })

    /** The total stays in pesos; the dollars inside it are listed apart, never added raw. */
    it('lists expenses in another currency with what they count for in the room currency', () => {
        const hotel = {
            ...expense('hotel', at(2026, 11, 12), '73500000', 'bea', [
                ['ana', '36750000'],
                ['bea', '36750000'],
            ]),
            currency: 'USD',
            amountMinor: '42000',
        } as ApiExpense
        const taxi = {
            ...expense('taxi', at(2026, 11, 13), '1750000', 'ana', [
                ['ana', '875000'],
                ['bea', '875000'],
            ]),
            currency: 'USD',
            amountMinor: '1000',
        } as ApiExpense
        const mixed = monthSummary({ expenses: [...expenses, hotel, taxi], room }, '2026-11')
        expect(mixed.totalMinor).toBe((121200n + 73500000n + 1750000n).toString())
        expect(mixed.converted).toEqual([{ currency: 'USD', amountMinor: '43000', baseAmountMinor: '75250000' }])
    })

    it('is empty, not broken, for a quiet month', () => {
        const quiet = monthSummary({ expenses, room }, '2026-09')
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

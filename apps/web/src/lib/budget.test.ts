import { describe, expect, it } from 'vitest'
import type { ApiExpense } from './api-types'
import { budgetAlerts, budgetLines, isBudgetCategory } from './budget'

const at = (year: number, month: number, day: number) => new Date(year, month - 1, day, 12).toISOString()

const expense = (description: string, date: string, amount: string, category: string | null = null): ApiExpense =>
    ({ id: description, description, date, baseAmountMinor: amount, category, shares: [] }) as unknown as ApiExpense

const expenses = [
    expense('Súper', at(2026, 11, 2), '120000'),
    expense('Verdulería', at(2026, 11, 9), '130000'),
    expense('Alquiler', at(2026, 11, 1), '400000'),
    expense('Cumple de Bea', at(2026, 11, 12), '50000', 'gifts-giving'),
    expense('Súper', at(2026, 10, 28), '999999'),
]

describe('budgetLines', () => {
    it('is empty when the tribu has no budget', () => {
        expect(budgetLines({ expenses }, '2026-11')).toEqual([])
        expect(budgetLines({ expenses, budgets: [] }, '2026-11')).toEqual([])
    })

    it('counts each expense in the category its description suggests, only in that month', () => {
        const lines = budgetLines(
            {
                expenses,
                budgets: [
                    { category: 'food-drink', amountMinor: '300000' },
                    { category: 'home-bills', amountMinor: '400000' },
                    { category: 'gifts-giving', amountMinor: '40000' },
                    { category: 'transport', amountMinor: '100000' },
                    { category: 'total', amountMinor: '1000000' },
                ],
            },
            '2026-11'
        )
        expect(lines.map((line) => [line.category, line.spentMinor, line.leftMinor, line.usedPct, line.level])).toEqual(
            [
                ['total', '700000', '300000', 70, 'ok'],
                ['gifts-giving', '50000', '-10000', 125, 'over'],
                ['home-bills', '400000', '0', 100, 'near'],
                ['food-drink', '250000', '50000', 83, 'near'],
                ['transport', '0', '100000', 0, 'ok'],
            ]
        )
    })

    it('calls a limit close from 80% and passed only above 100%', () => {
        const at80 = budgetLines({ expenses, budgets: [{ category: 'food-drink', amountMinor: '312500' }] }, '2026-11')
        expect(at80[0]).toMatchObject({ usedPct: 80, level: 'near' })
        const at79 = budgetLines({ expenses, budgets: [{ category: 'food-drink', amountMinor: '312501' }] }, '2026-11')
        expect(at79[0]).toMatchObject({ usedPct: 79, level: 'ok' })
    })

    it('ignores a category it does not know', () => {
        expect(budgetLines({ expenses, budgets: [{ category: 'yachts', amountMinor: '1' }] }, '2026-11')).toEqual([])
        expect(isBudgetCategory('yachts')).toBe(false)
        expect(isBudgetCategory('total')).toBe(true)
    })
})

describe('budgetAlerts', () => {
    it('puts passed limits before close ones and leaves out the rest', () => {
        const lines = budgetLines(
            {
                expenses,
                budgets: [
                    { category: 'food-drink', amountMinor: '300000' },
                    { category: 'gifts-giving', amountMinor: '40000' },
                    { category: 'transport', amountMinor: '100000' },
                ],
            },
            '2026-11'
        )
        expect(budgetAlerts(lines).map((line) => line.category)).toEqual(['gifts-giving', 'food-drink'])
    })
})

import { describe, expect, it } from 'vitest'
import { parseAprPercent, potYield } from './pot-yield'

const day = 24 * 60 * 60 * 1000
const start = Date.UTC(2026, 0, 1)
const iso = (days: number) => new Date(start + days * day).toISOString()

const pot = (yieldAprBps: number | null, contributions: [number, string][]) => ({
    id: 'pot',
    keeperId: 'ana',
    yieldAprBps,
    contributions: contributions.map(([days, amountMinor], i) => ({
        id: `c${i}`,
        memberId: 'bea',
        amountMinor,
        settlementId: null,
        createdAt: iso(days),
    })),
})

describe('potYield', () => {
    it('is nothing without a rate', () => {
        expect(potYield(pot(null, [[0, '100000']]), [], new Date(start + 365 * day))).toBeNull()
    })
    it('earns the yearly rate on money held a whole year', () => {
        const result = potYield(pot(500, [[0, '100000']]), [], new Date(start + 365 * day))
        expect(result).toEqual({ earnedMinor: '5000', nextYearMinor: '5000' })
    })
    it('weighs each amount by how long it was in', () => {
        // 100000 for half a year, then 200000 for the other half, at 10%: 5000 + 10000.
        const result = potYield(
            pot(1000, [
                [0, '100000'],
                [182.5, '100000'],
            ]),
            [],
            new Date(start + 365 * day)
        )
        expect(result?.earnedMinor).toBe('15000')
    })
    it('stops counting money the pot spent, and never earns on a negative pot', () => {
        const expenses = [
            { potId: 'pot', paidById: 'ana', baseAmountMinor: '150000', createdAt: iso(182.5) },
            { potId: 'pot', paidById: 'bea', baseAmountMinor: '999999', createdAt: iso(1) },
        ]
        const result = potYield(pot(1000, [[0, '100000']]), expenses, new Date(start + 365 * day))
        expect(result).toEqual({ earnedMinor: '5000', nextYearMinor: '0' })
    })
    it('ignores what happens after now', () => {
        const result = potYield(
            pot(1000, [
                [0, '100000'],
                [400, '100000'],
            ]),
            [],
            new Date(start + 365 * day)
        )
        expect(result?.earnedMinor).toBe('10000')
    })
})

describe('parseAprPercent', () => {
    it('reads a percent with either decimal mark', () => {
        expect(parseAprPercent('4')).toBe(400)
        expect(parseAprPercent('4,5')).toBe(450)
        expect(parseAprPercent('3.25')).toBe(325)
    })
    it('refuses zero, too much and junk', () => {
        expect(parseAprPercent('0')).toBeNull()
        expect(parseAprPercent('25')).toBeNull()
        expect(parseAprPercent('abc')).toBeNull()
    })
})

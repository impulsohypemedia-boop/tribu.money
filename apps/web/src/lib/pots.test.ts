import { describe, expect, it } from 'vitest'
import type { ApiExpense, ApiPot, RoomState } from './api-types'
import { potBySettlement, potSummary } from './pots'

const at = (year: number, month: number, day: number) => new Date(year, month - 1, day, 12).toISOString()
const now = new Date(2026, 10, 20, 12)

const members = ['ana', 'bea', 'cami'].map((id) => ({ id, removedAt: null, honoredGuest: false }))

const pot = (overrides: Partial<ApiPot> = {}): ApiPot => ({
    id: 'pot',
    name: 'Viaje',
    keeperId: 'ana',
    targetMinor: '90000',
    quotaMinor: null,
    dueDate: null,
    createdAt: at(2026, 10, 1),
    closedAt: null,
    contributions: [
        { id: 'c1', memberId: 'ana', amountMinor: '10000', settlementId: null, createdAt: at(2026, 10, 2) },
        { id: 'c2', memberId: 'bea', amountMinor: '10000', settlementId: 's2', createdAt: at(2026, 10, 3) },
        { id: 'c3', memberId: 'bea', amountMinor: '10000', settlementId: 's3', createdAt: at(2026, 11, 3) },
    ],
    ...overrides,
})

const expense = (id: string, paidById: string, amount: string, potId: string | null): ApiExpense =>
    ({ id, paidById, baseAmountMinor: amount, potId, shares: [] }) as unknown as ApiExpense

const state = (expenses: ApiExpense[] = [], extraMembers = members) =>
    ({ members: extraMembers, expenses, pots: [pot()] }) as unknown as RoomState

describe('potSummary', () => {
    it('adds up what went in and how far the goal is', () => {
        const summary = potSummary(pot(), state(), now)
        expect(summary.contributedMinor).toBe('30000')
        expect(summary.heldMinor).toBe('30000')
        expect(summary.progressPct).toBe(33)
        expect(summary.missingMinor).toBe('60000')
        expect(summary.byMember).toEqual([
            { memberId: 'bea', amountMinor: '20000' },
            { memberId: 'ana', amountMinor: '10000' },
        ])
    })

    it('takes what the pot paid out of what is held, only while the keeper is the payer', () => {
        const summary = potSummary(
            pot(),
            state([expense('dinner', 'ana', '12000', 'pot'), expense('moved', 'bea', '5000', 'pot')]),
            now
        )
        expect(summary.spentMinor).toBe('12000')
        expect(summary.heldMinor).toBe('18000')
        expect(summary.expenseIds).toEqual(['dinner'])
    })

    it('shows a negative balance when the keeper fronted more than the pot had', () => {
        const summary = potSummary(pot(), state([expense('big', 'ana', '50000', 'pot')]), now)
        expect(summary.heldMinor).toBe('-20000')
    })

    it('lists who still owes this month’s quota, leaving honored guests out', () => {
        const withGuest = [...members, { id: 'abu', removedAt: null, honoredGuest: true }]
        const summary = potSummary(pot({ quotaMinor: '10000' }), state([], withGuest), now)
        expect(summary.quotaMissing).toEqual([
            { memberId: 'ana', amountMinor: '10000' },
            { memberId: 'cami', amountMinor: '10000' },
        ])
    })

    it('projects the month the goal is reached at the quota pace', () => {
        // 60000 missing at 3 x 10000 a month: two months, this one included since it is not all in.
        const summary = potSummary(pot({ quotaMinor: '10000' }), state(), now)
        expect(summary.projectedMonth).toBe('2026-12')
    })

    it('projects from the average so far without a quota', () => {
        // 30000 over two months is 15000 a month, so 60000 more takes four.
        expect(potSummary(pot(), state(), now).projectedMonth).toBe('2027-03')
    })

    it('suggests a monthly quota to arrive by the due date', () => {
        // 60000 missing, three people, November to January: 3 months.
        const summary = potSummary(pot({ dueDate: at(2027, 1, 15) }), state(), now)
        expect(summary.suggestedQuotaMinor).toBe('6667')
    })

    it('stops at 100% and stops projecting once the goal is reached', () => {
        const summary = potSummary(pot({ targetMinor: '20000' }), state(), now)
        expect(summary.progressPct).toBe(100)
        expect(summary.missingMinor).toBe('0')
        expect(summary.projectedMonth).toBeNull()
    })

    it('has no progress without a target', () => {
        const summary = potSummary(pot({ targetMinor: null }), state(), now)
        expect(summary.progressPct).toBeNull()
        expect(summary.missingMinor).toBeNull()
    })
})

describe('potBySettlement', () => {
    it('maps the payments to the keeper back to their pot', () => {
        const map = potBySettlement(state())
        expect([...map.keys()].sort()).toEqual(['s2', 's3'])
        expect(map.get('s2')?.name).toBe('Viaje')
    })
})

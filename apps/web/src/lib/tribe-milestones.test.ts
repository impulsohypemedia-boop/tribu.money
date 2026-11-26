import { describe, expect, it } from 'vitest'
import type { RoomState } from './api-types'
import { PENDING_ID_PREFIX } from './pending'
import { tribeMilestones } from './tribe-milestones'

const members = ['ana', 'bea'].map((id) => ({ id, removedAt: null, honoredGuest: false }))
const expense = (id: string, paidById: string, currency = 'ARS') => ({
    id,
    paidById,
    currency,
    baseAmountMinor: '1000',
    shares: [
        { memberId: 'ana', amountMinor: '500' },
        { memberId: 'bea', amountMinor: '500' },
    ],
})
const room = (overrides: Partial<Record<string, unknown>> = {}) =>
    ({
        members,
        expenses: [],
        settlements: [],
        suggestedTransfers: [],
        pots: [],
        ...overrides,
    }) as unknown as RoomState

const reached = (state: RoomState) =>
    tribeMilestones(state)
        .filter((milestone) => milestone.reached)
        .map((milestone) => milestone.id)

describe('tribeMilestones', () => {
    it('reaches nothing in an empty room', () => {
        expect(reached(room())).toEqual([])
    })

    it('counts expenses and notices when everyone has paid something', () => {
        const expenses = Array.from({ length: 10 }, (_, i) => expense(`e${i}`, i === 0 ? 'bea' : 'ana'))
        const ids = reached(room({ expenses, suggestedTransfers: [{ fromId: 'bea', toId: 'ana' }] }))
        expect(ids).toEqual(['first-expense', 'expenses-10', 'everyone-paid'])
    })

    it('never counts an expense still waiting to be sent', () => {
        expect(reached(room({ expenses: [expense(`${PENDING_ID_PREFIX}1`, 'ana')] }))).toEqual([])
    })

    it('celebrates a first payment, a settled room and three currencies', () => {
        const ids = reached(
            room({
                expenses: [expense('a', 'ana', 'ARS'), expense('b', 'ana', 'USD'), expense('c', 'ana', 'EUR')],
                settlements: [{ id: 's' }],
            })
        )
        expect(ids).toEqual(['first-expense', 'first-payment', 'all-square', 'three-currencies'])
    })

    it('marks a vaquita that reached its goal', () => {
        const pot = {
            id: 'pot',
            keeperId: 'ana',
            targetMinor: '1000',
            quotaMinor: null,
            dueDate: null,
            createdAt: new Date().toISOString(),
            closedAt: null,
            contributions: [
                {
                    id: 'c',
                    memberId: 'bea',
                    amountMinor: '1000',
                    settlementId: null,
                    createdAt: new Date().toISOString(),
                },
            ],
        }
        expect(reached(room({ pots: [pot] }))).toEqual(['pot-goal'])
    })
})

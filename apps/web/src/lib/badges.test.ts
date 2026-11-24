import { describe, expect, it } from 'vitest'
import type { RoomState } from './api-types'
import { badgesInRoom, myBadges } from './badges'

const at = (hours: number) => new Date(Date.UTC(2026, 10, 1) + hours * 3600_000).toISOString()

const base = (overrides: Partial<RoomState> = {}) =>
    ({
        members: [
            { id: 'ana', removedAt: null },
            { id: 'bea', removedAt: null },
        ],
        expenses: [
            {
                id: 'e1',
                paidById: 'ana',
                createdAt: at(0),
                baseAmountMinor: '1000',
                potId: null,
                shares: [
                    { memberId: 'ana', amountMinor: '500' },
                    { memberId: 'bea', amountMinor: '500' },
                ],
            },
        ],
        settlements: [],
        pots: [],
        ...overrides,
    }) as unknown as RoomState

const settlement = (createdAt: string, token: string | null = null) => ({
    id: 's',
    fromId: 'bea',
    toId: 'ana',
    amountMinor: '500',
    createdAt,
    token,
})

describe('badgesInRoom', () => {
    it('gives the fast-payer badge only within a day', () => {
        expect(badgesInRoom(base({ settlements: [settlement(at(5))] } as never), 'bea').has('fast-payer')).toBe(true)
        expect(badgesInRoom(base({ settlements: [settlement(at(30))] } as never), 'bea').has('fast-payer')).toBe(false)
        // Ana paid the expense herself, so paying fast is not hers to earn here.
        expect(badgesInRoom(base({ settlements: [settlement(at(5))] } as never), 'ana').has('fast-payer')).toBe(false)
    })
    it('counts a crypto payment', () => {
        expect(badgesInRoom(base({ settlements: [settlement(at(50), 'USDC')] } as never), 'bea')).toContain(
            'crypto-payer'
        )
    })
    it('reads pots and round-ups', () => {
        const contributions = [1, 2, 3].map((i) => ({
            id: `c${i}`,
            memberId: 'bea',
            amountMinor: '10',
            settlementId: null,
            reason: 'roundup',
            createdAt: at(i),
        }))
        const state = base({
            pots: [
                {
                    id: 'p',
                    name: 'Pozo',
                    keeperId: 'ana',
                    targetMinor: '30',
                    quotaMinor: null,
                    dueDate: null,
                    createdAt: at(0),
                    closedAt: null,
                    contributions,
                },
            ],
        } as never)
        expect([...badgesInRoom(state, 'bea')].sort()).toEqual(['pot-goal', 'rounder'])
        expect([...badgesInRoom(state, 'ana')]).toEqual(['keeper'])
    })
})

describe('myBadges', () => {
    it('skips rooms where this phone is nobody, and keeps the first room per badge', () => {
        const state = base({ settlements: [settlement(at(1), 'USDT')] } as never)
        const found = myBadges([
            { slug: 'a', meId: null, state },
            { slug: 'b', meId: 'bea', state },
            { slug: 'c', meId: 'bea', state },
        ])
        expect(found.get('crypto-payer')).toBe('b')
    })
})

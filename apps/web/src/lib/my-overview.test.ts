import { describe, expect, it } from 'vitest'
import type { RoomState } from './api-types'
import { myActivity, myPositions, myPots, upcomingFixed, type MyRoom } from './my-overview'

const room = (slug: string, currency: string, extra: Record<string, unknown> = {}): RoomState =>
    ({
        room: { name: slug, currency },
        members: [
            { id: 'me', removedAt: null, honoredGuest: false },
            { id: 'bea', removedAt: null, honoredGuest: false },
        ],
        expenses: [],
        balances: {},
        recurring: [],
        pots: [],
        ...extra,
    }) as unknown as RoomState

describe('myPositions', () => {
    it('adds up what you are owed and what you owe, per currency, never across currencies', () => {
        const rooms: MyRoom[] = [
            { slug: 'casa', meId: 'me', state: room('casa', 'ARS', { balances: { me: '5000', bea: '-5000' } }) },
            { slug: 'viaje', meId: 'me', state: room('viaje', 'ARS', { balances: { me: '-2000', bea: '2000' } }) },
            { slug: 'europa', meId: 'me', state: room('europa', 'EUR', { balances: { me: '300', bea: '-300' } }) },
            { slug: 'square', meId: 'me', state: room('square', 'ARS', { balances: { me: '0', bea: '0' } }) },
        ]
        const result = myPositions(rooms)
        expect(result.totals).toEqual([
            { currency: 'ARS', owedToMeMinor: '5000', iOweMinor: '2000' },
            { currency: 'EUR', owedToMeMinor: '300', iOweMinor: '0' },
        ])
        expect(result.rooms.map((r) => r.slug)).toEqual(['casa', 'viaje', 'europa'])
    })

    it('leaves vaquitas out: what the keeper holds is not a debt to settle', () => {
        const state = room('regalo', 'ARS', { balances: { me: '-4000', bea: '4000' } })
        ;(state.room as { kind?: string }).kind = 'vaquita'
        expect(myPositions([{ slug: 'regalo', meId: 'me', state }])).toEqual({ totals: [], rooms: [] })
    })

    it('ignores a room this device never joined', () => {
        const rooms: MyRoom[] = [{ slug: 'x', meId: null, state: room('x', 'ARS', { balances: { bea: '100' } }) }]
        expect(myPositions(rooms)).toEqual({ totals: [], rooms: [] })
    })
})

describe('upcomingFixed', () => {
    it('lists what is still coming this month first, then what already went in', () => {
        const recurring = [
            { id: 'rent', description: 'Alquiler', amountMinor: '1', currency: 'ARS', paidById: null, dayOfMonth: 1 },
            {
                id: 'netflix',
                description: 'Netflix',
                amountMinor: '1',
                currency: 'ARS',
                paidById: null,
                dayOfMonth: 25,
            },
            { id: 'gym', description: 'Gym', amountMinor: '1', currency: 'ARS', paidById: null, dayOfMonth: 31 },
        ]
        const items = upcomingFixed(
            [{ slug: 'casa', meId: 'me', state: room('casa', 'ARS', { recurring }) }],
            new Date(2026, 10, 20)
        )
        expect(items.map((i) => [i.item.id, i.day, i.done])).toEqual([
            ['netflix', 25, false],
            ['gym', 30, false],
            ['rent', 1, true],
        ])
    })
})

describe('myPots', () => {
    it('lists open vaquitas, closest to the goal first', () => {
        const pot = (id: string, target: string, put: string, closedAt: string | null = null) => ({
            id,
            name: id,
            keeperId: 'me',
            targetMinor: target,
            quotaMinor: null,
            dueDate: null,
            createdAt: new Date(2026, 10, 1).toISOString(),
            closedAt,
            contributions: [
                {
                    id: 'c',
                    memberId: 'bea',
                    amountMinor: put,
                    settlementId: null,
                    createdAt: new Date(2026, 10, 2).toISOString(),
                },
            ],
        })
        const state = room('casa', 'ARS', {
            pots: [pot('a', '1000', '100'), pot('b', '1000', '900'), pot('c', '10', '1', 'x')],
        })
        expect(myPots([{ slug: 'casa', meId: 'me', state }]).map((p) => p.pot.id)).toEqual(['b', 'a'])
    })
})

describe('myActivity', () => {
    it('lists what you paid, shared, sent and received, newest first, and nothing else', () => {
        const state = room('casa', 'ARS', {
            members: [
                { id: 'me', name: 'Yo', removedAt: null },
                { id: 'bea', name: 'Bea', removedAt: null },
                { id: 'cami', name: 'Cami', removedAt: null },
            ],
            expenses: [
                {
                    id: 'e1',
                    description: 'Súper',
                    amountMinor: '100',
                    currency: 'ARS',
                    paidById: 'me',
                    createdAt: '2026-11-01',
                    shares: [],
                },
                {
                    id: 'e2',
                    description: 'Pizza',
                    amountMinor: '50',
                    currency: 'ARS',
                    paidById: 'bea',
                    createdAt: '2026-11-03',
                    shares: [{ memberId: 'me' }],
                },
                {
                    id: 'e3',
                    description: 'Ajeno',
                    amountMinor: '9',
                    currency: 'ARS',
                    paidById: 'bea',
                    createdAt: '2026-11-05',
                    shares: [{ memberId: 'cami' }],
                },
            ],
            settlements: [
                { id: 's1', fromId: 'me', toId: 'bea', amountMinor: '25', createdAt: '2026-11-04' },
                { id: 's2', fromId: 'cami', toId: 'me', amountMinor: '30', createdAt: '2026-11-02' },
            ],
        })
        const items = myActivity([{ slug: 'casa', meId: 'me', state }])
        expect(items.map((i) => [i.kind, i.label])).toEqual([
            ['sent', 'Bea'],
            ['shared', 'Pizza'],
            ['received', 'Cami'],
            ['paid', 'Súper'],
        ])
    })
})

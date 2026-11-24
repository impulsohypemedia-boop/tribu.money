import { describe, expect, it } from 'vitest'
import type { ApiExpense, ApiPot, RoomState } from './api-types'
import type { MyRoom } from './my-overview'
import { patrimony, scaledRate, toUsdCents } from './patrimony'

const at = (year: number, month: number, day: number) => new Date(year, month - 1, day, 12).toISOString()
const now = new Date(2026, 10, 20, 12)
const members = ['ana', 'bea'].map((id) => ({ id, removedAt: null, honoredGuest: false }))
const decimals = (code: string) => (code === 'JPY' ? 0 : 2)

const contribution = (id: string, amountMinor: string, createdAt: string) => ({
    id,
    memberId: 'bea',
    amountMinor,
    settlementId: null,
    createdAt,
})

const pot = (id: string, contributions: ApiPot['contributions'], closedAt: string | null = null): ApiPot => ({
    id,
    name: id,
    keeperId: 'ana',
    targetMinor: null,
    quotaMinor: null,
    dueDate: null,
    createdAt: at(2026, 9, 1),
    closedAt,
    contributions,
})

const room = (slug: string, currency: string, pots: ApiPot[], expenses: Partial<ApiExpense>[] = []): MyRoom => ({
    slug,
    meId: 'ana',
    state: {
        room: { name: slug, currency, kind: 'tribu' },
        members,
        expenses,
        pots,
    } as unknown as RoomState,
})

describe('scaledRate', () => {
    it('reads plain decimals and refuses anything else', () => {
        expect(scaledRate('1')).toBe(10n ** 12n)
        expect(scaledRate('0.000689655172')).toBe(689655172n)
        expect(scaledRate('1e-4')).toBeNull()
        expect(scaledRate('0')).toBeNull()
        expect(scaledRate('-1')).toBeNull()
        expect(scaledRate(undefined)).toBeNull()
    })
})

describe('toUsdCents', () => {
    it('converts at the rate, rounding half away from zero', () => {
        // $1.450.000,00 at 1450 pesos per dollar is US$ 1000.
        expect(toUsdCents(145_000_000n, 'ARS', 2, { ARS: '0.000689655172414' })).toBe(100_000n)
        expect(toUsdCents(-145_000_000n, 'ARS', 2, { ARS: '0.000689655172414' })).toBe(-100_000n)
        expect(toUsdCents(1n, 'EUR', 2, { EUR: '1.005' })).toBe(1n)
        expect(toUsdCents(1000n, 'JPY', 0, { JPY: '0.0065' })).toBe(650n)
    })

    it('counts digital dollars one to one without a rate', () => {
        expect(toUsdCents(1234n, 'USDC', 2, {})).toBe(1234n)
        expect(toUsdCents(1234n, 'USDT', 2, {})).toBe(1234n)
    })

    it('says so when it has no rate', () => {
        expect(toUsdCents(1234n, 'XYZ', 2, {})).toBeNull()
    })
})

describe('patrimony', () => {
    const rates = { ARS: '0.001', EUR: '1.1' }

    it('adds what every open pot holds, in dollars, minus what the pots paid', () => {
        const result = patrimony(
            [
                room(
                    'casa',
                    'ARS',
                    [pot('super', [contribution('a', '5000000', at(2026, 10, 2))])],
                    [{ id: 'e1', paidById: 'ana', potId: 'super', baseAmountMinor: '1000000', date: at(2026, 11, 5) }]
                ),
                room('viaje', 'EUR', [pot('pasajes', [contribution('b', '10000', at(2026, 11, 1))])]),
                room('sin-pozo', 'EUR', []),
            ],
            rates,
            decimals,
            now
        )
        // ARS 40.000 = US$ 40; EUR 100 = US$ 110.
        expect(result.totalUsdCents).toBe('15000')
        expect(result.byRoom.map((r) => [r.slug, r.heldMinor, r.usdCents])).toEqual([
            ['viaje', '10000', '11000'],
            ['casa', '4000000', '4000'],
        ])
        expect(result.byCurrency).toEqual([
            { currency: 'EUR', heldMinor: '10000', usdCents: '11000' },
            { currency: 'ARS', heldMinor: '4000000', usdCents: '4000' },
        ])
        expect(result.unpriced).toEqual([])
    })

    it('leaves closed pots out', () => {
        const result = patrimony(
            [room('casa', 'EUR', [pot('old', [contribution('a', '10000', at(2026, 10, 2))], at(2026, 10, 30))])],
            rates,
            decimals,
            now
        )
        expect(result.totalUsdCents).toBe('0')
        expect(result.byRoom).toEqual([])
        expect(result.history).toEqual([])
    })

    it('keeps a currency without a rate out of the total and names it', () => {
        const result = patrimony(
            [room('club', 'XYZ', [pot('p', [contribution('a', '500', at(2026, 11, 1))])])],
            rates,
            decimals,
            now
        )
        expect(result.totalUsdCents).toBe('0')
        expect(result.unpriced).toEqual(['XYZ'])
        expect(result.byRoom[0].usdCents).toBeNull()
    })

    it('replays the months from the first contribution to now', () => {
        const result = patrimony(
            [
                room(
                    'casa',
                    'EUR',
                    [
                        pot('p', [
                            contribution('a', '10000', at(2026, 8, 10)),
                            contribution('b', '5000', at(2026, 10, 10)),
                        ]),
                    ],
                    [{ id: 'e1', paidById: 'ana', potId: 'p', baseAmountMinor: '2000', date: at(2026, 11, 2) }]
                ),
            ],
            { EUR: '1' },
            decimals,
            now
        )
        expect(result.history).toEqual([
            { month: '2026-08', usdCents: '10000' },
            { month: '2026-09', usdCents: '10000' },
            { month: '2026-10', usdCents: '15000' },
            { month: '2026-11', usdCents: '13000' },
        ])
        expect(result.totalUsdCents).toBe('13000')
    })

    it('draws at least two points when everything happened this month', () => {
        const result = patrimony(
            [room('casa', 'EUR', [pot('p', [contribution('a', '10000', at(2026, 11, 1))])])],
            { EUR: '1' },
            decimals,
            now
        )
        expect(result.history).toEqual([
            { month: '2026-10', usdCents: '0' },
            { month: '2026-11', usdCents: '10000' },
        ])
    })

    it('caps the history at the months asked for', () => {
        const result = patrimony(
            [room('casa', 'EUR', [pot('p', [contribution('a', '100', at(2024, 1, 1))])])],
            { EUR: '1' },
            decimals,
            now,
            3
        )
        expect(result.history.map((p) => p.month)).toEqual(['2026-09', '2026-10', '2026-11'])
        expect(result.history[0].usdCents).toBe('100')
    })
})

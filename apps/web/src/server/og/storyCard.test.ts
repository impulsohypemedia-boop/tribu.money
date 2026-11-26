import { beforeAll, describe, expect, it } from 'vitest'
import { getTranslator, type Translator } from '@/i18n/t'
import type { RoomRecap } from '@/server/og/recapCard'
import { toStoryCard } from '@/server/og/storyCard'

let t: Translator
beforeAll(async () => {
    t = await getTranslator('es-419')
})

const recap = (overrides: Partial<RoomRecap> = {}): RoomRecap => ({
    name: 'Viaje a Bariloche',
    emoji: null,
    currency: 'USD',
    locale: 'es-419',
    totalMinor: '180000',
    expenseCount: 3,
    memberCount: 3,
    dayCount: 2,
    settlementCount: 2,
    members: [
        { name: 'Ana', avatar: null, avatarPalette: null },
        { name: 'Bruno', avatar: null, avatarPalette: null },
    ],
    topPayerName: 'Ana',
    settled: true,
    ...overrides,
})

describe('toStoryCard', () => {
    it('celebrates a settled trip with what the group spent together', () => {
        const card = toStoryCard(recap(), 'tribu', null, t)
        expect(card.headline).toBe('¡Todos a mano!')
        expect(card.amount).toContain('1.800')
        expect(card.amountCaption).toBe('gastamos juntos')
        expect(card.progressPct).toBeNull()
    })

    it('says how the trip is going while it is still open', () => {
        expect(toStoryCard(recap({ settled: false }), 'tribu', null, t).headline).toBe('Así va la tribu')
    })

    it('shows what a vaquita raised against its goal', () => {
        const pot = { contributedMinor: 15000n, targetMinor: 30000n, contributors: 3, closed: false }
        const card = toStoryCard(recap(), 'vaquita', pot, t)
        expect(card.headline).toBe('Así va la vaquita')
        expect(card.amount).toContain('150')
        expect(card.amountCaption).toBe('lo juntamos entre 3')
        expect(card.detail).toContain('Meta:')
        expect(card.progressPct).toBe(50)
    })

    it('marks a vaquita that reached its goal and never draws past 100%', () => {
        const pot = { contributedMinor: 40000n, targetMinor: 30000n, contributors: 2, closed: false }
        const card = toStoryCard(recap(), 'vaquita', pot, t)
        expect(card.headline).toBe('¡Vaquita completa!')
        expect(card.progressPct).toBe(100)
    })

    it('leaves the goal line out of a vaquita without a goal', () => {
        const pot = { contributedMinor: 5000n, targetMinor: null, contributors: 1, closed: true }
        const card = toStoryCard(recap(), 'vaquita', pot, t)
        expect(card.headline).toBe('Vaquita cerrada')
        expect(card.detail).toBe('')
        expect(card.progressPct).toBeNull()
    })
})

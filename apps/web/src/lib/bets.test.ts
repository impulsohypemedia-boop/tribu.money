import { describe, expect, it } from 'vitest'
import { betActions, betLoser, type BetFacts } from './bets'

const bet = (status: BetFacts['status'], claimedById: string | null = null): BetFacts => ({
    status,
    proposerId: 'ana',
    rivalId: 'bea',
    claimedById,
})

describe('betActions', () => {
    it('only the rival accepts', () => {
        expect(betActions(bet('proposed'), 'bea')).toEqual(['accept', 'cancel'])
        expect(betActions(bet('proposed'), 'ana')).toEqual(['cancel'])
    })
    it('either one says who won', () => {
        expect(betActions(bet('accepted'), 'ana')).toContain('claim')
        expect(betActions(bet('accepted'), 'bea')).toContain('claim')
    })
    it('the other one confirms or disputes a claim', () => {
        expect(betActions(bet('claimed', 'ana'), 'ana')).toEqual(['cancel'])
        expect(betActions(bet('claimed', 'ana'), 'bea')).toEqual(['confirm', 'dispute', 'cancel'])
    })
    it('outsiders and finished bets get nothing', () => {
        expect(betActions(bet('accepted'), 'cami')).toEqual([])
        expect(betActions(bet('accepted'), null)).toEqual([])
        expect(betActions(bet('resolved'), 'ana')).toEqual([])
        expect(betActions(bet('cancelled'), 'bea')).toEqual([])
    })
})

describe('betLoser', () => {
    it('is the other person', () => {
        expect(betLoser(bet('claimed'), 'ana')).toBe('bea')
        expect(betLoser(bet('claimed'), 'bea')).toBe('ana')
    })
})

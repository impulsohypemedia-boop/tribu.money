import { describe, expect, it } from 'vitest'
import { fineOutcome, fineVoterIds } from './fines'

describe('fineOutcome', () => {
    const voters = ['a', 'b', 'c', 'd']
    it('needs more than half', () => {
        expect(fineOutcome({ a: true, b: true }, voters)).toBe('voting')
        expect(fineOutcome({ a: true, b: true, c: true }, voters)).toBe('approved')
    })
    it('rejects once a majority cannot be reached', () => {
        expect(fineOutcome({ a: false }, voters)).toBe('voting')
        expect(fineOutcome({ a: false, b: false }, voters)).toBe('rejected')
    })
    it('ignores votes from people who cannot vote', () => {
        expect(fineOutcome({ x: true, y: true, z: true, a: true }, voters)).toBe('voting')
    })
    it('passes a fine with nobody left to vote', () => {
        expect(fineOutcome({}, [])).toBe('approved')
    })
    it('in a pair, the other person decides', () => {
        expect(fineOutcome({ b: true }, ['b'])).toBe('approved')
        expect(fineOutcome({ b: false }, ['b'])).toBe('rejected')
    })
})

describe('fineVoterIds', () => {
    it('leaves out the fined person and former members', () => {
        const members = [
            { id: 'a', removedAt: null },
            { id: 'b', removedAt: null },
            { id: 'c', removedAt: '2026-01-01' },
        ]
        expect(fineVoterIds(members, 'a')).toEqual(['b'])
    })
})

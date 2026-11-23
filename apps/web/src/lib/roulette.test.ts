import { describe, expect, it } from 'vitest'
import { drawWinner, sha256Hex, verifyDraw } from './roulette'

describe('drawWinner', () => {
    it('ignores the order people were picked in', async () => {
        const a = await drawWinner('seed', 'phone', ['c', 'a', 'b'])
        const b = await drawWinner('seed', 'phone', ['b', 'c', 'a'])
        expect(a).toEqual(b)
    })
    it('is the hash of both seeds and the roster, modulo the roster', async () => {
        const hash = await sha256Hex('seed:phone:a,b,c')
        const index = Number(BigInt(`0x${hash}`) % 3n)
        expect((await drawWinner('seed', 'phone', ['a', 'b', 'c'])).winnerId).toBe(['a', 'b', 'c'][index])
    })
    it('spreads over everyone', async () => {
        const seen = new Set<string>()
        for (let i = 0; i < 60; i++) seen.add((await drawWinner(`s${i}`, 'x', ['a', 'b', 'c'])).winnerId)
        expect(seen).toEqual(new Set(['a', 'b', 'c']))
    })
    it('refuses an empty draw', async () => {
        await expect(drawWinner('s', 'c', [])).rejects.toThrow()
    })
})

describe('verifyDraw', () => {
    it('accepts an honest draw and rejects a swapped seed or winner', async () => {
        const seed = 'abc123'
        const seedHash = await sha256Hex(seed)
        const { winnerId } = await drawWinner(seed, 'phone', ['a', 'b'])
        const honest = { seed, seedHash, clientSeed: 'phone', participantIds: ['a', 'b'], winnerId }
        expect(await verifyDraw(honest)).toBe(true)
        expect(await verifyDraw({ ...honest, seed: 'other' })).toBe(false)
        expect(await verifyDraw({ ...honest, winnerId: winnerId === 'a' ? 'b' : 'a' })).toBe(false)
    })
})

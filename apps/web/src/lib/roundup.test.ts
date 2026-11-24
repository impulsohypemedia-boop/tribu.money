import { describe, expect, it } from 'vitest'
import { defaultRoundUpUnit, roundUpDifference, unitToMinor } from './roundup'

describe('roundUpDifference', () => {
    it('rounds up to the next step', () => {
        expect(roundUpDifference('1234', 100n)).toBe('66')
        expect(roundUpDifference('12345000', unitToMinor(1000, 2))).toBe('55000')
    })
    it('adds nothing to an amount that is already round', () => {
        expect(roundUpDifference('5000', 100n)).toBe('0')
    })
    it('refuses nonsense quietly', () => {
        expect(roundUpDifference('0', 100n)).toBe('0')
        expect(roundUpDifference('-5', 100n)).toBe('0')
        expect(roundUpDifference('5', 0n)).toBe('0')
    })
    it('stays exact past Number', () => {
        expect(roundUpDifference('90071992547409931', 100n)).toBe('69')
    })
})

describe('defaultRoundUpUnit', () => {
    it('uses a bigger step for pesos', () => {
        expect(defaultRoundUpUnit('ARS')).toBe(1000)
        expect(defaultRoundUpUnit('MXN')).toBe(100)
        expect(defaultRoundUpUnit('USD')).toBe(1)
    })
})

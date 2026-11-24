import { describe, expect, it } from 'vitest'
import { formatUsd, majorityOf, parseTokenAmount, vaquitaContract, vaquitaWalletId } from './vaquita'

describe('vaquitaWalletId', () => {
    it('matches the id TribuVaquita.potIdFor computes on chain', () => {
        // Read from the compiled contract (contracts/) for this creator and pot id.
        expect(vaquitaWalletId('0x1111111111111111111111111111111111111111', 'pot-123')).toBe(
            '0xdd97d39322b4f0aa021b8264b6a6aa8466d97973f77d49ca0799878e1927f165'
        )
    })

    it('differs per creator and per pot', () => {
        const a = vaquitaWalletId('0x1111111111111111111111111111111111111111', 'pot-1')
        expect(vaquitaWalletId('0x2222222222222222222222222222222222222222', 'pot-1')).not.toBe(a)
        expect(vaquitaWalletId('0x1111111111111111111111111111111111111111', 'pot-2')).not.toBe(a)
    })
})

describe('parseTokenAmount', () => {
    it('reads dollars into 6-decimal units, with a comma or a dot', () => {
        expect(parseTokenAmount('12,5', 6)).toBe(12_500_000n)
        expect(parseTokenAmount('12.50', 6)).toBe(12_500_000n)
        expect(parseTokenAmount(' 3 ', 6)).toBe(3_000_000n)
        expect(parseTokenAmount('0.000001', 6)).toBe(1n)
    })

    it('refuses zero, negatives, too many decimals and thousands separators', () => {
        expect(parseTokenAmount('0', 6)).toBeNull()
        expect(parseTokenAmount('-1', 6)).toBeNull()
        expect(parseTokenAmount('1.0000001', 6)).toBeNull()
        expect(parseTokenAmount('1.000,50', 6)).toBeNull()
        expect(parseTokenAmount('', 6)).toBeNull()
        expect(parseTokenAmount('abc', 6)).toBeNull()
    })
})

describe('formatUsd', () => {
    it('rounds down to the cent, so nobody is shown more than they can take out', () => {
        expect(formatUsd(12_509_999n, 6, 'en')).toBe('$12.50')
        expect(formatUsd(0n, 6, 'en')).toBe('$0.00')
    })
})

describe('majorityOf', () => {
    it('is more than half', () => {
        expect([1, 2, 3, 4, 5].map(majorityOf)).toEqual([1, 2, 2, 3, 3])
    })
})

describe('vaquitaContract', () => {
    it('is off until a valid address is configured', () => {
        expect(vaquitaContract(undefined)).toBeNull()
        expect(vaquitaContract('nope')).toBeNull()
        expect(vaquitaContract('0x1234567890123456789012345678901234567890')).toBe(
            '0x1234567890123456789012345678901234567890'
        )
    })
})

import { describe, expect, it } from 'vitest'
import { availableStablecoins, formatTokenUnits, lemonNetwork, sameAddress, usdCentsToTokenUnits } from './chain'

describe('lemon network config', () => {
    it('defaults to Polygon mainnet with USDC and USDT', () => {
        const network = lemonNetwork(undefined, undefined)
        expect(network.chainId).toBe(137)
        expect(availableStablecoins(network).map((t) => t.symbol)).toEqual(['USDC', 'USDT'])
    })

    it('offers only USDC on Amoy unless a test USDT address is configured', () => {
        expect(availableStablecoins(lemonNetwork('polygon-amoy', undefined)).map((t) => t.symbol)).toEqual(['USDC'])
        const withUsdt = lemonNetwork('polygon-amoy', '0x1234567890123456789012345678901234567890')
        expect(withUsdt.chainId).toBe(80002)
        expect(availableStablecoins(withUsdt).map((t) => t.symbol)).toEqual(['USDC', 'USDT'])
    })
})

describe('stablecoin amounts', () => {
    it('turns cents into 6-decimal token units exactly', () => {
        const usdc = lemonNetwork('polygon').tokens.USDC!
        expect(usdCentsToTokenUnits(1234n, usdc)).toBe(12_340_000n)
        expect(usdCentsToTokenUnits(0n, usdc)).toBe(0n)
    })

    it('refuses a negative amount', () => {
        expect(() => usdCentsToTokenUnits(-1n, lemonNetwork('polygon').tokens.USDT!)).toThrow(RangeError)
    })

    it('formats base units without trailing zeros', () => {
        expect(formatTokenUnits(12_500_000n, 6)).toBe('12.5')
        expect(formatTokenUnits(12_000_000n, 6)).toBe('12')
        expect(formatTokenUnits(1n, 6)).toBe('0.000001')
    })

    it('compares addresses regardless of case', () => {
        expect(
            sameAddress('0xAbC0000000000000000000000000000000000001', '0xabc0000000000000000000000000000000000001')
        ).toBe(true)
        expect(sameAddress(null, '0xabc0000000000000000000000000000000000001')).toBe(false)
    })
})

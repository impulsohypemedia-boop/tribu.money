import { describe, expect, it } from 'vitest'
import { normalizePayoutAddress, payoutOf, shortAddress } from './payout'

describe('normalizePayoutAddress', () => {
    const evm = '0xAbCdEf0123456789abcdef0123456789ABCDEF01'

    it('accepts an EVM address on an EVM network and stores it lowercase', () => {
        expect(normalizePayoutAddress('polygon', `  ${evm} `)).toBe(evm.toLowerCase())
    })

    it('refuses an EVM address that is too short or not hex', () => {
        expect(normalizePayoutAddress('polygon', evm.slice(0, -1))).toBeNull()
        expect(normalizePayoutAddress('base', `0x${'g'.repeat(40)}`)).toBeNull()
    })

    it('keeps Tron addresses case-sensitive and refuses EVM ones there', () => {
        const tron = 'TJRabPrwbZy45sbavfcjinPJC18kjpRTv8'
        expect(normalizePayoutAddress('tron', tron)).toBe(tron)
        expect(normalizePayoutAddress('tron', evm)).toBeNull()
        expect(normalizePayoutAddress('polygon', tron)).toBeNull()
    })
})

describe('payoutOf', () => {
    it('needs a known token, a known network and an address', () => {
        const full = { payoutToken: 'USDT', payoutNetwork: 'polygon', payoutAddress: '0xabc' }
        expect(payoutOf(full)).toEqual({ token: 'USDT', network: 'polygon', address: '0xabc' })
        expect(payoutOf({ ...full, payoutToken: 'DAI' })).toBeNull()
        expect(payoutOf({ ...full, payoutNetwork: 'solana' })).toBeNull()
        expect(payoutOf({ ...full, payoutAddress: null })).toBeNull()
    })
})

describe('shortAddress', () => {
    it('keeps the start and the end', () => {
        expect(shortAddress('0x1234567890abcdef1234567890abcdef12345678')).toBe('0x1234…5678')
    })
})

import { describe, expect, it } from 'vitest'
import {
    hasPaymentMethod,
    normalizeBankAccount,
    normalizeLemonTag,
    normalizePayoutAddress,
    paymentMethodsOf,
    payoutOf,
    shortAddress,
} from './payout'

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

describe('normalizeBankAccount', () => {
    it('accepts a 22-digit CBU/CVU and drops spaces and dashes', () => {
        expect(normalizeBankAccount('0000003100 0123456789-01')).toBe('0000003100012345678901')
    })

    it('accepts an alias as typed', () => {
        expect(normalizeBankAccount(' Marcos.Tribu.Mp ')).toBe('Marcos.Tribu.Mp')
    })

    it('refuses something that is neither', () => {
        expect(normalizeBankAccount('abc')).toBeNull()
        expect(normalizeBankAccount('alias con espacios')).toBeNull()
        expect(normalizeBankAccount('123456789012345678901')).toBeNull()
        expect(normalizeBankAccount('12345678')).toBeNull()
    })
})

describe('normalizeLemonTag', () => {
    it('drops the @ and lowercases', () => {
        expect(normalizeLemonTag(' @Marcos.D ')).toBe('marcos.d')
    })

    it('refuses spaces and empty tags', () => {
        expect(normalizeLemonTag('@')).toBeNull()
        expect(normalizeLemonTag('mar cos')).toBeNull()
    })
})

describe('paymentMethodsOf', () => {
    it('prefers the typed Lemon tag over the signed one', () => {
        expect(paymentMethodsOf({ payoutLemonTag: 'typed', lemonTag: 'signed' }).lemonTag).toBe('typed')
        expect(paymentMethodsOf({ lemonTag: '@signed' }).lemonTag).toBe('signed')
    })

    it('reports nothing when the member saved nothing', () => {
        const methods = paymentMethodsOf({})
        expect(methods).toEqual({ bank: null, lemonTag: null, crypto: null })
        expect(hasPaymentMethod(methods)).toBe(false)
    })
})

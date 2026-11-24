import { describe, expect, it } from 'vitest'
import { buildUsdRateTable, usdPerUnit } from './usd-rates'

describe('usdPerUnit', () => {
    it('inverts units per dollar into a plain decimal', () => {
        expect(usdPerUnit(4)).toBe('0.25')
        expect(usdPerUnit('1450')).toBe('0.000689655172414')
        expect(usdPerUnit(26000)).toBe('0.000038461538462')
    })

    it('refuses zero, negatives and junk', () => {
        expect(usdPerUnit(0)).toBeNull()
        expect(usdPerUnit(-2)).toBeNull()
        expect(usdPerUnit('abc')).toBeNull()
        expect(usdPerUnit(undefined)).toBeNull()
    })
})

describe('buildUsdRateTable', () => {
    it('prices pesos at the dólar cripto and the rest from the daily table', () => {
        const table = buildUsdRateTable(
            { venta: 1500, compra: 1450 },
            { result: 'success', rates: { USD: 1, ARS: 1000, EUR: 0.8, bogus: 3 } }
        )
        expect(table.rates.ARS).toBe('0.000666666666667')
        expect(table.sources.ARS).toBe('dolar-cripto')
        expect(table.arsPerUsd).toBe('1500')
        expect(table.rates.EUR).toBe('1.25')
        expect(table.sources.EUR).toBe('open-er-api')
        expect(table.rates.USD).toBe('1')
        expect(table.rates.bogus).toBeUndefined()
    })

    it('falls back to the static table when both sources fail', () => {
        const table = buildUsdRateTable(null, null)
        expect(table.sources.ARS).toBe('static')
        expect(table.sources.EUR).toBe('static')
        expect(table.arsPerUsd).toBeNull()
    })

    it('ignores a table that did not answer success', () => {
        const table = buildUsdRateTable(null, { result: 'error', rates: { EUR: 0.5 } })
        expect(table.sources.EUR).toBe('static')
    })
})

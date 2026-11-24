import { describe, expect, it } from 'vitest'
import { formatUsd } from './UsdMoney'

describe('formatUsd', () => {
    it('writes dollars as US$ so they never read as pesos', () => {
        expect(formatUsd('257900', 'es-419')).toMatch(/^US\$ 2.579.00$/)
        expect(formatUsd('-1050', 'es-419')).toMatch(/^-US\$ 10.50$/)
        expect(formatUsd('100', 'en')).toMatch(/^US\$ 1.00$/)
    })
})

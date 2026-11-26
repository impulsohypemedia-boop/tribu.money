import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Without the Peanut feed configured, expenses are priced from the same public dollar quotes as
 * the patrimonio screen. The case this guards: a US$ 100 expense in a peso tribu must convert at
 * the dólar cripto quote, not at the static outage table's 1.031 pesos per dollar.
 */
vi.mock('@/server/db', () => ({
    prisma: {
        fxRate: { findMany: vi.fn(async () => []) },
        $executeRaw: vi.fn(async () => 0),
        $transaction: vi.fn(async () => []),
    },
}))

const quotes = (url: string) => {
    if (url.includes('dolarapi')) return { venta: 1750 }
    return {
        result: 'success',
        rates: {
            USD: 1,
            EUR: 0.9,
            GBP: 0.8,
            BRL: 5.5,
            MXN: 18,
            COP: 4000,
            CHF: 0.88,
            THB: 34,
            JPY: 150,
            AUD: 1.5,
            CAD: 1.4,
            ARS: 1450,
        },
    }
}

beforeEach(() => {
    process.env.SPLIT_FX_MODE = ''
    delete process.env.SPLIT_FX_ENDPOINT
    vi.stubGlobal(
        'fetch',
        vi.fn(
            async (input: string | URL | Request) =>
                new Response(JSON.stringify(quotes(String(input))), { status: 200 })
        )
    )
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)
})

afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
    vi.resetModules()
    process.env.SPLIT_FX_MODE = 'static'
})

describe('dollar-anchored expense rates', () => {
    it('prices dollars in a peso tribu at the dólar cripto quote', async () => {
        const { getRate, convertMinor } = await import('@/server/fx')
        const { rate, source } = await getRate('USD', 'ARS')
        expect(source).toBe('live')
        expect(rate).toBeCloseTo(1750, 6)
        expect(await convertMinor(10000n, 'USD', 'ARS')).toBe(17500000n)
    })

    it('prices pesos in a dollar tribu with the same quote', async () => {
        const { getRate } = await import('@/server/fx')
        const { rate } = await getRate('ARS', 'USD')
        expect(rate).toBeCloseTo(1 / 1750, 9)
    })

    it('falls back to the static table when neither source answers', async () => {
        vi.stubGlobal(
            'fetch',
            vi.fn(async () => new Response('nope', { status: 503 }))
        )
        const { getRate } = await import('@/server/fx')
        expect((await getRate('USD', 'ARS')).source).toBe('static')
    })
})

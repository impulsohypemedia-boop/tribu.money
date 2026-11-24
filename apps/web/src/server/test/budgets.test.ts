/** Presupuesto del grupo, against the real handlers and database. */
import { beforeEach, describe, expect, it } from 'vitest'
import { truncateAll } from '@/server/test/db'
import { resetEvents } from '@/server/events'
import { resetRateLimits } from '@/server/rateLimit'
import { POST as postRoom } from '@/app/api/rooms/route'
import { POST as putBudgets } from '@/app/api/rooms/[slug]/budgets/route'
import type { ApiError, RoomState, RoomStateWithMember } from '@/lib/api-types'

type Params = Record<string, string>
type Handler = (request: Request, ctx: { params: Promise<Params> }) => Promise<Response>
type Reply = RoomState & ApiError

const call = async (handler: Handler, method: string, params: Params, body: unknown) => {
    const request = new Request('http://localhost/api', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    })
    const res = await handler(request, { params: Promise.resolve(params) })
    return { status: res.status, body: (await res.json()) as Reply }
}

const makeRoom = async (kind: 'tribu' | 'vaquita' = 'tribu') =>
    (
        await call(
            postRoom as Handler,
            'POST',
            {},
            {
                name: 'Casa',
                currency: 'ARS',
                creatorName: 'Ana',
                kind,
                ...(kind === 'vaquita' ? { pot: { targetMinor: '100000' } } : {}),
            }
        )
    ).body as unknown as RoomStateWithMember

const save = (slug: string, budgets: unknown) => call(putBudgets as Handler, 'POST', { slug }, { budgets })

beforeEach(async () => {
    await truncateAll()
    resetRateLimits()
    resetEvents()
})

describe('POST /budgets', () => {
    it('saves the limits and returns them on the room', async () => {
        const room = await makeRoom()
        const res = await save(room.room.slug, [
            { category: 'total', amountMinor: '50000000' },
            { category: 'food-drink', amountMinor: '30000000' },
        ])
        expect(res.status).toBe(200)
        expect(res.body.budgets).toEqual([
            { category: 'food-drink', amountMinor: '30000000' },
            { category: 'total', amountMinor: '50000000' },
        ])
    })

    it('replaces the whole list, so a limit left out is removed', async () => {
        const room = await makeRoom()
        await save(room.room.slug, [
            { category: 'total', amountMinor: '100' },
            { category: 'transport', amountMinor: '50' },
        ])
        const res = await save(room.room.slug, [{ category: 'transport', amountMinor: '70' }])
        expect(res.body.budgets).toEqual([{ category: 'transport', amountMinor: '70' }])
        const cleared = await save(room.room.slug, [])
        expect(cleared.body.budgets).toEqual([])
    })

    it('refuses unknown categories, repeated ones and zero amounts', async () => {
        const room = await makeRoom()
        expect((await save(room.room.slug, [{ category: 'yachts', amountMinor: '1' }])).status).toBe(400)
        expect((await save(room.room.slug, [{ category: 'total', amountMinor: '0' }])).status).toBe(400)
        expect(
            (
                await save(room.room.slug, [
                    { category: 'total', amountMinor: '1' },
                    { category: 'total', amountMinor: '2' },
                ])
            ).status
        ).toBe(400)
    })

    it('is for tribus, not vaquitas', async () => {
        const room = await makeRoom('vaquita')
        const res = await save(room.room.slug, [{ category: 'total', amountMinor: '1' }])
        expect(res.status).toBe(400)
        expect(res.body.error.code).toBe('BUDGET_NOT_FOR_VAQUITA')
    })
})

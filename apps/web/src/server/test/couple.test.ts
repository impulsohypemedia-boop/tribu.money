/** Tribu de pareja: creating one and saving its default split, against the real handlers. */
import { beforeEach, describe, expect, it } from 'vitest'
import { truncateAll } from '@/server/test/db'
import { resetEvents } from '@/server/events'
import { resetRateLimits } from '@/server/rateLimit'
import { POST as postRoom } from '@/app/api/rooms/route'
import { POST as postCoupleSplit } from '@/app/api/rooms/[slug]/couple-split/route'
import { POST as postBudgets } from '@/app/api/rooms/[slug]/budgets/route'
import type { ApiError, RoomState, RoomStateWithMember } from '@/lib/api-types'

type Params = Record<string, string>
type Handler = (request: Request, ctx: { params: Promise<Params> }) => Promise<Response>
type Reply = RoomState & ApiError

const call = async (handler: Handler, params: Params, body: unknown) => {
    const request = new Request('http://localhost/api', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    })
    const res = await handler(request, { params: Promise.resolve(params) })
    return { status: res.status, body: (await res.json()) as Reply }
}

const makeRoom = async (kind: 'tribu' | 'pareja') =>
    (
        await call(
            postRoom as Handler,
            {},
            { name: 'Ana y Leo', currency: 'ARS', creatorName: 'Ana', memberNames: ['Leo'], kind }
        )
    ).body as unknown as RoomStateWithMember

const saveSplit = (slug: string, split: unknown) => call(postCoupleSplit as Handler, { slug }, { split })

beforeEach(async () => {
    await truncateAll()
    resetRateLimits()
    resetEvents()
})

describe('tribu de pareja', () => {
    it('is created as a pareja with the two people and starts at half and half', async () => {
        const room = await makeRoom('pareja')
        expect(room.room.kind).toBe('pareja')
        expect(room.members.map((member) => member.name)).toEqual(['Ana', 'Leo'])
        expect(room.room.coupleSplit).toBeNull()
        expect(room.room.theme).toBe('bubblegum')
    })

    it('saves a 60/40 split and goes back to half and half with null', async () => {
        const room = await makeRoom('pareja')
        const [ana, leo] = room.members
        const saved = await saveSplit(room.room.slug, { [ana.id]: 60, [leo.id]: 40 })
        expect(saved.status).toBe(200)
        expect(saved.body.room.coupleSplit).toEqual({ [ana.id]: 60, [leo.id]: 40 })
        const cleared = await saveSplit(room.room.slug, null)
        expect(cleared.body.room.coupleSplit).toBeNull()
    })

    it('refuses parts that do not add up to 100, or someone outside the tribu', async () => {
        const room = await makeRoom('pareja')
        const [ana, leo] = room.members
        expect((await saveSplit(room.room.slug, { [ana.id]: 60, [leo.id]: 50 })).status).toBe(400)
        expect((await saveSplit(room.room.slug, { [ana.id]: 60, stranger: 40 })).status).toBe(400)
    })

    it('is only for a couple tribu', async () => {
        const room = await makeRoom('tribu')
        const [ana, leo] = room.members
        const res = await saveSplit(room.room.slug, { [ana.id]: 60, [leo.id]: 40 })
        expect(res.status).toBe(400)
        expect((res.body as unknown as { error: { code: string } }).error.code).toBe('NOT_A_COUPLE')
        expect(room.room.coupleSplit).toBeNull()
    })

    it('keeps the monthly budget a pareja shares with any tribu', async () => {
        const room = await makeRoom('pareja')
        const res = await call(
            postBudgets as Handler,
            { slug: room.room.slug },
            {
                budgets: [{ category: 'total', amountMinor: '100000' }],
            }
        )
        expect(res.status).toBe(200)
    })
})

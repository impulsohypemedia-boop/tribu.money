/** The pot's yield rate and the round-up label, against the real handlers and database. */
import { beforeEach, describe, expect, it } from 'vitest'
import { truncateAll } from '@/server/test/db'
import { resetEvents } from '@/server/events'
import { resetRateLimits } from '@/server/rateLimit'
import { POST as postRoom } from '@/app/api/rooms/route'
import { POST as postMember } from '@/app/api/rooms/[slug]/members/route'
import { POST as postPot } from '@/app/api/rooms/[slug]/pots/route'
import { PATCH as patchPot } from '@/app/api/rooms/[slug]/pots/[potId]/route'
import { POST as postContribution } from '@/app/api/rooms/[slug]/pots/[potId]/contributions/route'
import type { ApiError, RoomState, RoomStateWithMember } from '@/lib/api-types'

type Params = Record<string, string>
type Handler = (request: Request, ctx: { params: Promise<Params> }) => Promise<Response>
type Reply = RoomState & ApiError

const call = async (
    handler: Handler,
    opts: { path: string; body?: unknown; params?: Params; token?: string }
): Promise<{ status: number; body: Reply }> => {
    const request = new Request(`http://localhost${opts.path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(opts.token ? { 'X-Member-Token': opts.token } : {}) },
        body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
    })
    const res = await handler(request, { params: Promise.resolve(opts.params ?? {}) })
    return { status: res.status, body: (await res.json()) as Reply }
}

async function makeRoom() {
    const { body } = await call(postRoom as Handler, {
        path: '/api/rooms',
        body: { name: 'Amigos', emoji: 'ski', currency: 'USD', creatorName: 'Ana' },
    })
    const created = body as unknown as RoomStateWithMember
    const slug = created.room.slug
    const join = async (name: string) =>
        (await call(postMember as Handler, { path: `/api/rooms/${slug}/members`, params: { slug }, body: { name } }))
            .body as unknown as RoomStateWithMember
    const bruno = await join('Bruno')
    const cami = await join('Cami')
    return {
        slug,
        ana: { id: created.memberId, token: created.memberToken },
        bruno: { id: bruno.memberId, token: bruno.memberToken },
        cami: { id: cami.memberId, token: cami.memberToken },
    }
}
type Room = Awaited<ReturnType<typeof makeRoom>>

beforeEach(async () => {
    await truncateAll()
    resetRateLimits()
    resetEvents()
})

describe('la vaquita que rinde y el redondeo', () => {
    it('stores the rate and labels a round-up', async () => {
        const room = await makeRoom()
        const pot = await call(postPot as Handler, {
            path: '',
            params: { slug: room.slug },
            body: { name: 'Pozo', keeperId: room.ana.id, yieldAprBps: 450 },
        })
        const potId = pot.body.pots![0].id
        expect(pot.body.pots![0].yieldAprBps).toBe(450)
        const tooHigh = await call(patchPot as Handler, {
            path: '',
            params: { slug: room.slug, potId },
            body: { yieldAprBps: 9000 },
        })
        expect(tooHigh.status).toBe(400)
        const rounded = await call(postContribution as Handler, {
            path: '',
            params: { slug: room.slug, potId },
            body: { memberId: room.bruno.id, amountMinor: '66', reason: 'roundup' },
        })
        expect(rounded.body.pots![0].contributions[0].reason).toBe('roundup')
        const spoofed = await call(postContribution as Handler, {
            path: '',
            params: { slug: room.slug, potId },
            body: { memberId: room.bruno.id, amountMinor: '66', reason: 'fine' },
        })
        expect(spoofed.status).toBe(400)
    })
})

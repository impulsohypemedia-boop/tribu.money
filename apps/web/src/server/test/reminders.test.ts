/** Recordatorio amable, against the real handlers and database. */
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { prisma, truncateAll } from '@/server/test/db'
import { resetEvents } from '@/server/events'
import { resetPushConfig } from '@/server/push'
import { resetRateLimits } from '@/server/rateLimit'
import { POST as postRoom } from '@/app/api/rooms/route'
import { POST as postMember } from '@/app/api/rooms/[slug]/members/route'
import { POST as postExpense } from '@/app/api/rooms/[slug]/expenses/route'
import { POST as postReminder } from '@/app/api/rooms/[slug]/reminders/route'
import { POST as postSeen } from '@/app/api/rooms/[slug]/reminders/[id]/seen/route'
import type { ApiError, RoomState, RoomStateWithMember } from '@/lib/api-types'

const { sendNotification } = vi.hoisted(() => ({ sendNotification: vi.fn() }))
vi.mock('web-push', async (importOriginal) => {
    const actual = (await importOriginal()) as typeof import('web-push')
    return { ...actual, default: { setVapidDetails: vi.fn(), sendNotification } }
})

type Params = Record<string, string>
type Handler = (request: Request, ctx: { params: Promise<Params> }) => Promise<Response>
type Reply = RoomState & ApiError

const call = async (
    handler: Handler,
    opts: { params: Params; body?: unknown; token?: string }
): Promise<{ status: number; body: Reply }> => {
    const request = new Request('http://localhost/api', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(opts.token ? { 'X-Member-Token': opts.token } : {}) },
        body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
    })
    const res = await handler(request, { params: Promise.resolve(opts.params) })
    return { status: res.status, body: (await res.json()) as Reply }
}

/** Ana paid 30 for three, so Bruno and Cami each pass her 10. */
async function makeRoom() {
    const created = (
        await call(postRoom as Handler, {
            params: {},
            body: { name: 'Amigos', currency: 'USD', creatorName: 'Ana' },
        })
    ).body as unknown as RoomStateWithMember
    const slug = created.room.slug
    const join = async (name: string) =>
        (await call(postMember as Handler, { params: { slug }, body: { name } })).body as unknown as RoomStateWithMember
    const bruno = await join('Bruno')
    const cami = await join('Cami')
    await call(postExpense as Handler, {
        params: { slug },
        body: {
            description: 'Asado',
            amountMinor: '3000',
            currency: 'USD',
            paidById: created.memberId,
            splitMode: 'EQUAL',
        },
    })
    return {
        slug,
        roomId: created.room.id,
        ana: { id: created.memberId, token: created.memberToken },
        bruno: { id: bruno.memberId, token: bruno.memberToken },
        cami: { id: cami.memberId, token: cami.memberToken },
    }
}

const remind = (slug: string, toId: string, token?: string) =>
    call(postReminder as Handler, { params: { slug }, body: { toId }, token })

beforeAll(() => {
    process.env.SPLIT_VAPID_PUBLIC_KEY = 'test-public'
    process.env.SPLIT_VAPID_PRIVATE_KEY = 'test-private'
    process.env.SPLIT_VAPID_SUBJECT = 'mailto:test@tribu.money'
})

beforeEach(async () => {
    await truncateAll()
    resetRateLimits()
    resetEvents()
    resetPushConfig()
    sendNotification.mockReset()
    sendNotification.mockResolvedValue({ statusCode: 201 })
})

describe('recordatorio amable', () => {
    it('lets the person owed remind the person who owes, once every few days', async () => {
        const room = await makeRoom()
        const sent = await remind(room.slug, room.bruno.id, room.ana.token)
        expect(sent.status).toBe(201)
        expect(sent.body.reminders).toHaveLength(1)
        expect(sent.body.reminders![0]).toMatchObject({ fromId: room.ana.id, toId: room.bruno.id, seenAt: null })

        const again = await remind(room.slug, room.bruno.id, room.ana.token)
        expect(again.status).toBe(429)
        expect(again.body.error.code).toBe('REMINDER_TOO_SOON')

        // Cami is a different person, so she can still be reminded.
        expect((await remind(room.slug, room.cami.id, room.ana.token)).status).toBe(201)
    })

    it('refuses reminders that are not about money owed to the sender', async () => {
        const room = await makeRoom()
        const backwards = await remind(room.slug, room.ana.id, room.bruno.token)
        expect(backwards.status).toBe(409)
        expect(backwards.body.error.code).toBe('REMINDER_NOTHING_PENDING')
        expect((await remind(room.slug, room.cami.id, room.bruno.token)).status).toBe(409)
        expect((await remind(room.slug, room.bruno.id)).status).toBe(403)
    })

    it('only the person reminded can put the notice away', async () => {
        const room = await makeRoom()
        const reminderId = (await remind(room.slug, room.bruno.id, room.ana.token)).body.reminders![0].id
        const params = { slug: room.slug, id: reminderId }
        expect((await call(postSeen as Handler, { params, token: room.cami.token })).status).toBe(403)
        const seen = await call(postSeen as Handler, { params, token: room.bruno.token })
        expect(seen.status).toBe(200)
        expect(seen.body.reminders![0].seenAt).not.toBeNull()
    })

    it('sends the push notification to the person reminded and nobody else', async () => {
        const room = await makeRoom()
        for (const [memberId, endpoint] of [
            [room.ana.id, 'https://fcm.googleapis.com/fcm/send/ana'],
            [room.bruno.id, 'https://fcm.googleapis.com/fcm/send/bruno'],
            [room.cami.id, 'https://fcm.googleapis.com/fcm/send/cami'],
        ]) {
            await prisma.pushSubscription.create({
                data: { roomId: room.roomId, memberId, endpoint, p256dh: 'p256dh', auth: 'auth' },
            })
        }
        sendNotification.mockClear()
        await remind(room.slug, room.bruno.id, room.ana.token)
        await vi.waitFor(() => expect(sendNotification).toHaveBeenCalledTimes(1))
        const [target, payload] = sendNotification.mock.calls[0] as [{ endpoint: string }, string]
        expect(target.endpoint).toContain('bruno')
        expect(JSON.parse(payload)).toMatchObject({ template: 'reminder' })
        expect(JSON.parse(payload).body).toContain('Ana')
    })
})

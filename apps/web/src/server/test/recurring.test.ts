/**
 * Monthly expenses against the real handlers and database: a template copied from a saved
 * expense creates each missing month once, through the normal expense path, and stops cleanly.
 */
import { beforeEach, describe, expect, it } from 'vitest'
import { prisma, truncateAll } from '@/server/test/db'
import { resetEvents } from '@/server/events'
import { resetRateLimits } from '@/server/rateLimit'
import { materializeRecurring } from '@/server/recurring'
import { roomStateBySlug } from '@/server/roomState'
import { POST as postRoom } from '@/app/api/rooms/route'
import { POST as postMember } from '@/app/api/rooms/[slug]/members/route'
import { POST as postExpense } from '@/app/api/rooms/[slug]/expenses/route'
import { POST as postRecurring } from '@/app/api/rooms/[slug]/recurring/route'
import { DELETE as deleteRecurring } from '@/app/api/rooms/[slug]/recurring/[recurringId]/route'
import type { RoomState, RoomStateWithMember } from '@/lib/api-types'

type Params = Record<string, string>
type Handler = (request: Request, ctx: { params: Promise<Params> }) => Promise<Response>

const call = async <T>(handler: Handler, opts: { path: string; method?: string; body?: unknown; params?: Params }) => {
    const request = new Request(`http://localhost${opts.path}`, {
        method: opts.method ?? 'GET',
        headers: { 'Content-Type': 'application/json' },
        body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
    })
    const res = await handler(request, { params: Promise.resolve(opts.params ?? {}) })
    return { status: res.status, body: (await res.json()) as T }
}

async function makeRoom() {
    const { body: created } = await call<RoomStateWithMember>(postRoom as Handler, {
        path: '/api/rooms',
        method: 'POST',
        body: { name: 'Depto', emoji: 'ski', currency: 'USD', creatorName: 'Ana' },
    })
    const slug = created.room.slug
    const { body: bruno } = await call<RoomStateWithMember>(postMember as Handler, {
        path: `/api/rooms/${slug}/members`,
        method: 'POST',
        params: { slug },
        body: { name: 'Bruno' },
    })
    return { slug, anaId: created.memberId, brunoId: bruno.memberId }
}

const addNetflix = (slug: string, paidById: string, date: string) =>
    call<RoomState>(postExpense as Handler, {
        path: `/api/rooms/${slug}/expenses`,
        method: 'POST',
        params: { slug },
        body: { description: 'Netflix', amountMinor: '1000', currency: 'USD', paidById, splitMode: 'EQUAL', date },
    })

const repeat = (slug: string, expenseId: string) =>
    call<RoomState>(postRecurring as Handler, {
        path: `/api/rooms/${slug}/recurring`,
        method: 'POST',
        params: { slug },
        body: { expenseId },
    })

beforeEach(async () => {
    await truncateAll()
    resetRateLimits()
    resetEvents()
})

describe('monthly expenses', () => {
    it('creates each missing month once, with the same split', async () => {
        const room = await makeRoom()
        const first = await addNetflix(room.slug, room.anaId, '2026-08-05T12:00:00.000Z')
        const started = await repeat(room.slug, first.body.expenses[0].id)
        expect(started.status).toBe(201)
        expect(started.body.recurring).toHaveLength(1)
        expect(started.body.expenses[0].recurringId).toBe(started.body.recurring![0].id)

        const now = new Date('2026-11-20T15:00:00Z')
        expect(await materializeRecurring(room.slug, now)).toBe(true)
        // Again, as a second phone opening the room at the same time would.
        expect(await materializeRecurring(room.slug, now)).toBe(false)

        const expenses = await prisma.expense.findMany({
            where: { room: { slug: room.slug } },
            orderBy: { date: 'asc' },
            include: { shares: true },
        })
        expect(expenses.map((e) => e.date.toISOString().slice(0, 10))).toEqual([
            '2026-08-05',
            '2026-09-05',
            '2026-10-05',
            '2026-11-05',
        ])
        for (const expense of expenses) {
            expect(expense.shares.map((share) => share.amountMinor)).toEqual([500n, 500n])
        }
        // Four months of 1000 paid by Ana, half each: Bruno owes 2000.
        const state = await roomStateBySlug(room.slug)
        expect(state.balances[room.brunoId]).toBe('-2000')
        expect(state.balances[room.anaId]).toBe('2000')
    })

    it('stops when asked, keeping the months already created', async () => {
        const room = await makeRoom()
        const first = await addNetflix(room.slug, room.anaId, '2026-09-05T12:00:00.000Z')
        const started = await repeat(room.slug, first.body.expenses[0].id)
        await materializeRecurring(room.slug, new Date('2026-10-20T00:00:00Z'))
        const id = started.body.recurring![0].id
        const stopped = await call<RoomState>(deleteRecurring as Handler, {
            path: `/api/rooms/${room.slug}/recurring/${id}`,
            method: 'DELETE',
            params: { slug: room.slug, recurringId: id },
        })
        expect(stopped.status).toBe(200)
        expect(stopped.body.recurring).toEqual([])
        expect(await materializeRecurring(room.slug, new Date('2027-03-01T00:00:00Z'))).toBe(false)
        expect(await prisma.expense.count({ where: { room: { slug: room.slug } } })).toBe(2)
    })

    it('includes someone who joins later when the split was everyone', async () => {
        const room = await makeRoom()
        const first = await addNetflix(room.slug, room.anaId, '2026-10-05T12:00:00.000Z')
        await repeat(room.slug, first.body.expenses[0].id)
        await call<RoomStateWithMember>(postMember as Handler, {
            path: `/api/rooms/${room.slug}/members`,
            method: 'POST',
            params: { slug: room.slug },
            body: { name: 'Caro' },
        })
        await materializeRecurring(room.slug, new Date('2026-11-20T00:00:00Z'))
        const november = await prisma.expense.findFirst({
            where: { room: { slug: room.slug }, date: { gte: new Date('2026-11-01T00:00:00Z') } },
            include: { shares: true },
        })
        expect(november?.shares).toHaveLength(3)
    })
})

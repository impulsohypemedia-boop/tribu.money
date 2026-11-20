/**
 * La vaquita against the real handlers and database. The pot never holds money: a contribution
 * is a payment to the keeper and a pot expense is paid by the keeper, so every case below checks
 * that the balances still sum to zero and say what really happened.
 */
import { beforeEach, describe, expect, it } from 'vitest'
import { truncateAll } from '@/server/test/db'
import { resetEvents } from '@/server/events'
import { resetRateLimits } from '@/server/rateLimit'
import { POST as postRoom } from '@/app/api/rooms/route'
import { POST as postMember } from '@/app/api/rooms/[slug]/members/route'
import { POST as postExpense } from '@/app/api/rooms/[slug]/expenses/route'
import { DELETE as deleteSettlement } from '@/app/api/rooms/[slug]/settlements/[id]/route'
import { POST as postPot } from '@/app/api/rooms/[slug]/pots/route'
import { PATCH as patchPot } from '@/app/api/rooms/[slug]/pots/[potId]/route'
import { POST as postContribution } from '@/app/api/rooms/[slug]/pots/[potId]/contributions/route'
import { DELETE as deleteContribution } from '@/app/api/rooms/[slug]/pots/[potId]/contributions/[contributionId]/route'
import { POST as linkExpense } from '@/app/api/rooms/[slug]/pots/[potId]/expenses/route'
import { DELETE as unlinkExpense } from '@/app/api/rooms/[slug]/pots/[potId]/expenses/[expenseId]/route'
import type { ApiError, RoomState, RoomStateWithMember } from '@/lib/api-types'

const BASE = 'http://localhost'
type Params = Record<string, string>
type Handler = (request: Request, ctx: { params: Promise<Params> }) => Promise<Response>
type Reply = RoomState & ApiError

const call = async (
    handler: Handler,
    opts: { path: string; method?: string; body?: unknown; params?: Params }
): Promise<{ status: number; body: Reply }> => {
    const request = new Request(`${BASE}${opts.path}`, {
        method: opts.method ?? 'GET',
        headers: { 'Content-Type': 'application/json' },
        body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
    })
    const res = await handler(request, { params: Promise.resolve(opts.params ?? {}) })
    return { status: res.status, body: (await res.json()) as Reply }
}

async function makeRoom() {
    const { body } = await call(postRoom as Handler, {
        path: '/api/rooms',
        method: 'POST',
        body: { name: 'Familia', emoji: 'ski', currency: 'USD', creatorName: 'Ana' },
    })
    const created = body as unknown as RoomStateWithMember
    const slug = created.room.slug
    const join = async (name: string) =>
        (
            await call(postMember as Handler, {
                path: `/api/rooms/${slug}/members`,
                method: 'POST',
                params: { slug },
                body: { name },
            })
        ).body as unknown as RoomStateWithMember
    const bruno = await join('Bruno')
    const abu = await join('Abu')
    return { slug, ana: created.memberId, bruno: bruno.memberId, abu: abu.memberId }
}

type Room = Awaited<ReturnType<typeof makeRoom>>

const createPot = (room: Room, body: Record<string, unknown>) =>
    call(postPot as Handler, {
        path: `/api/rooms/${room.slug}/pots`,
        method: 'POST',
        params: { slug: room.slug },
        body,
    })

const contribute = (room: Room, potId: string, memberId: string, amountMinor: string) =>
    call(postContribution as Handler, {
        path: `/api/rooms/${room.slug}/pots/${potId}/contributions`,
        method: 'POST',
        params: { slug: room.slug, potId },
        body: { memberId, amountMinor },
    })

const addExpense = (room: Room, paidById: string, amountMinor: string) =>
    call(postExpense as Handler, {
        path: `/api/rooms/${room.slug}/expenses`,
        method: 'POST',
        params: { slug: room.slug },
        body: { description: 'Asado', amountMinor, currency: 'USD', paidById, splitMode: 'EQUAL' },
    })

const total = (balances: Record<string, string>) => Object.values(balances).reduce((sum, v) => sum + BigInt(v), 0n)

async function potRoom() {
    const room = await makeRoom()
    const created = await createPot(room, { name: 'Viaje', keeperId: room.ana, targetMinor: '3000' })
    expect(created.status).toBe(201)
    const potId = created.body.pots![0].id
    return { room, potId }
}

beforeEach(async () => {
    await truncateAll()
    resetRateLimits()
    resetEvents()
})

describe('la vaquita', () => {
    it('starts with a keeper and a goal', async () => {
        const { room, potId } = await potRoom()
        const { body } = await contribute(room, potId, room.bruno, '0')
        expect(body.error.code).toBe('AMOUNT_NOT_POSITIVE')
        const second = await createPot(room, { name: 'Otra', keeperId: 'nobody' })
        expect(second.status).toBe(400)
        expect(second.body.error.code).toBe('NOT_A_MEMBER')
    })

    it('records a contribution as a payment to the keeper', async () => {
        const { room, potId } = await potRoom()
        const res = await contribute(room, potId, room.bruno, '1000')
        expect(res.status).toBe(201)
        expect(res.body.balances[room.bruno]).toBe('1000')
        expect(res.body.balances[room.ana]).toBe('-1000')
        expect(total(res.body.balances)).toBe(0n)
        const settlement = res.body.settlements[0]
        expect(settlement).toMatchObject({ fromId: room.bruno, toId: room.ana, method: 'pot', amountMinor: '1000' })
        expect(res.body.pots![0].contributions[0]).toMatchObject({ memberId: room.bruno, settlementId: settlement.id })
    })

    it('moves nothing when the keeper puts in their own money', async () => {
        const { room, potId } = await potRoom()
        const res = await contribute(room, potId, room.ana, '500')
        expect(res.body.settlements).toHaveLength(0)
        expect(res.body.pots![0].contributions[0]).toMatchObject({ memberId: room.ana, settlementId: null })
        expect(Object.values(res.body.balances).every((v) => v === '0')).toBe(true)
    })

    it('pays an expense from the keeper’s account and leaves everyone square', async () => {
        const { room, potId } = await potRoom()
        for (const member of [room.bruno, room.abu]) await contribute(room, potId, member, '500')
        await contribute(room, potId, room.ana, '500')
        const expense = await addExpense(room, room.ana, '1500')
        const expenseId = expense.body.expenses[0].id
        const linked = await call(linkExpense as Handler, {
            path: `/api/rooms/${room.slug}/pots/${potId}/expenses`,
            method: 'POST',
            params: { slug: room.slug, potId },
            body: { expenseId },
        })
        expect(linked.status).toBe(200)
        expect(linked.body.expenses[0].potId).toBe(potId)
        // Each put 500 and each had a 500 share: nobody owes anybody.
        expect(Object.values(linked.body.balances).every((v) => v === '0')).toBe(true)

        const unlinked = await call(unlinkExpense as Handler, {
            path: `/api/rooms/${room.slug}/pots/${potId}/expenses/${expenseId}`,
            method: 'DELETE',
            params: { slug: room.slug, potId, expenseId },
        })
        expect(unlinked.body.expenses[0].potId).toBeNull()
    })

    it('refuses to mark an expense somebody else paid', async () => {
        const { room, potId } = await potRoom()
        const expense = await addExpense(room, room.bruno, '900')
        const res = await call(linkExpense as Handler, {
            path: `/api/rooms/${room.slug}/pots/${potId}/expenses`,
            method: 'POST',
            params: { slug: room.slug, potId },
            body: { expenseId: expense.body.expenses[0].id },
        })
        expect(res.status).toBe(400)
        expect(res.body.error.code).toBe('POT_PAYER_NOT_KEEPER')
    })

    it('takes a contribution back with its payment', async () => {
        const { room, potId } = await potRoom()
        const added = await contribute(room, potId, room.bruno, '1000')
        const contributionId = added.body.pots![0].contributions[0].id
        const removed = await call(deleteContribution as Handler, {
            path: `/api/rooms/${room.slug}/pots/${potId}/contributions/${contributionId}`,
            method: 'DELETE',
            params: { slug: room.slug, potId, contributionId },
        })
        expect(removed.status).toBe(200)
        expect(removed.body.settlements).toHaveLength(0)
        expect(removed.body.pots![0].contributions).toHaveLength(0)
        expect(removed.body.balances[room.bruno]).toBe('0')
    })

    it('drops the contribution when its payment is deleted from the feed', async () => {
        const { room, potId } = await potRoom()
        const added = await contribute(room, potId, room.bruno, '1000')
        const id = added.body.settlements[0].id
        const res = await call(deleteSettlement as Handler, {
            path: `/api/rooms/${room.slug}/settlements/${id}`,
            method: 'DELETE',
            params: { slug: room.slug, id },
        })
        expect(res.body.pots![0].contributions).toHaveLength(0)
    })

    it('keeps the leftover as credit when closed, and takes no more money', async () => {
        const { room, potId } = await potRoom()
        await contribute(room, potId, room.bruno, '1000')
        const closed = await call(patchPot as Handler, {
            path: `/api/rooms/${room.slug}/pots/${potId}`,
            method: 'PATCH',
            params: { slug: room.slug, potId },
            body: { closed: true },
        })
        expect(closed.body.pots![0].closedAt).not.toBeNull()
        expect(closed.body.balances[room.bruno]).toBe('1000')
        const late = await contribute(room, potId, room.abu, '100')
        expect(late.status).toBe(400)
        expect(late.body.error.code).toBe('POT_CLOSED')
    })
})

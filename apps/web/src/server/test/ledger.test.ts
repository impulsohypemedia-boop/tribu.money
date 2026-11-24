/**
 * The book of account against the real handlers and database: every write leaves the book in
 * line with the rows, corrections are reversals, and the database refuses edits, deletes and
 * entries that don't balance.
 */
import { beforeEach, describe, expect, it } from 'vitest'
import { prisma, truncateAll } from '@/server/test/db'
import { resetEvents } from '@/server/events'
import { resetRateLimits } from '@/server/rateLimit'
import { balancesOf, loadRoom } from '@/server/roomState'
import { ledgerMemberBalances, roomLedgerBySlug, syncRoomLedger } from '@/server/ledger'
import { POST as postRoom } from '@/app/api/rooms/route'
import { POST as postMember } from '@/app/api/rooms/[slug]/members/route'
import { POST as postExpense } from '@/app/api/rooms/[slug]/expenses/route'
import { PATCH as patchExpense, DELETE as deleteExpense } from '@/app/api/rooms/[slug]/expenses/[id]/route'
import { POST as restoreExpense } from '@/app/api/rooms/[slug]/expenses/[id]/restore/route'
import { POST as postSettlement } from '@/app/api/rooms/[slug]/settlements/route'
import { DELETE as deleteSettlement } from '@/app/api/rooms/[slug]/settlements/[id]/route'
import { POST as postPot } from '@/app/api/rooms/[slug]/pots/route'
import { POST as postContribution } from '@/app/api/rooms/[slug]/pots/[potId]/contributions/route'
import { POST as linkExpense } from '@/app/api/rooms/[slug]/pots/[potId]/expenses/route'
import { GET as getRoom } from '@/app/api/rooms/[slug]/route'
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
        body: { name: 'Casa', emoji: 'ski', currency: 'USD', creatorName: 'Ana' },
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
    return { slug, roomId: created.room.id, ana: created.memberId, bruno: bruno.memberId, abu: abu.memberId }
}
type Room = Awaited<ReturnType<typeof makeRoom>>

const addExpense = (room: Room, paidById: string, amountMinor: string) =>
    call(postExpense as Handler, {
        path: `/api/rooms/${room.slug}/expenses`,
        method: 'POST',
        params: { slug: room.slug },
        body: { description: 'Súper', amountMinor, currency: 'USD', paidById, splitMode: 'EQUAL' },
    })

const pay = (room: Room, fromId: string, toId: string, amountMinor: string) =>
    call(postSettlement as Handler, {
        path: `/api/rooms/${room.slug}/settlements`,
        method: 'POST',
        params: { slug: room.slug },
        body: { fromId, toId, amountMinor },
    })

/** The book agrees with the rows: same balances, every entry balances, one live record per movement. */
async function expectBookInLine(room: Room) {
    const loaded = await loadRoom(room.slug)
    const folded = balancesOf(loaded)
    const book = await ledgerMemberBalances(
        prisma,
        room.roomId,
        loaded.members.map((member) => member.id)
    )
    expect(Object.fromEntries(book)).toEqual(Object.fromEntries(folded))

    const entries = await prisma.ledgerEntry.findMany({
        where: { roomId: room.roomId },
        include: { postings: true, reversedBy: true },
    })
    for (const entry of entries) {
        expect(entry.postings.reduce((sum, posting) => sum + posting.amountMinor, 0n)).toBe(0n)
    }
    const liveSources = entries.filter((entry) => entry.kind === 'record' && !entry.reversedBy).map((e) => e.sourceId)
    expect(new Set(liveSources).size).toBe(liveSources.length)
    // Running the sync again finds nothing to do.
    expect(await prisma.$transaction((tx) => syncRoomLedger(tx, room.roomId))).toBe(0)
    return entries
}

beforeEach(async () => {
    await truncateAll()
    resetRateLimits()
    resetEvents()
})

describe('libro contable', () => {
    it('records an expense and a payment as balanced entries', async () => {
        const room = await makeRoom()
        await addExpense(room, room.ana, '900')
        await pay(room, room.bruno, room.ana, '300')
        const entries = await expectBookInLine(room)
        expect(entries.map((entry) => [entry.sourceType, entry.kind])).toEqual([
            ['expense', 'record'],
            ['settlement', 'record'],
        ])
        const expense = entries[0]
        expect(expense.description).toBe('Súper')
        expect(expense.postings.map((posting) => [posting.accountId, posting.amountMinor]).sort()).toEqual(
            [
                [room.ana, 900n],
                [room.ana, -300n],
                [room.bruno, -300n],
                [room.abu, -300n],
            ].sort()
        )
    })

    it('corrects an edit with a reversal and a new record, never by changing the old one', async () => {
        const room = await makeRoom()
        const added = await addExpense(room, room.ana, '900')
        const original = added.body.expenses[0]
        const edited = await call(patchExpense as Handler, {
            path: `/api/rooms/${room.slug}/expenses/${original.id}`,
            method: 'PATCH',
            params: { slug: room.slug, id: original.id },
            body: {
                expectedRevision: original.revision,
                description: 'Súper grande',
                amountMinor: '1200',
                currency: 'USD',
                paidById: room.bruno,
                splitMode: 'EQUAL',
            },
        })
        expect(edited.status).toBe(200)
        const entries = await expectBookInLine(room)
        expect(entries.map((entry) => entry.kind)).toEqual(['record', 'reversal', 'record'])
        expect(entries[1].reversesId).toBe(entries[0].id)
        expect(entries[0].description).toBe('Súper')
        expect(entries[2].description).toBe('Súper grande')
    })

    it('cancels a deleted expense and records it again when restored', async () => {
        const room = await makeRoom()
        const added = await addExpense(room, room.ana, '900')
        const id = added.body.expenses[0].id
        await call(deleteExpense as Handler, {
            path: `/api/rooms/${room.slug}/expenses/${id}`,
            method: 'DELETE',
            params: { slug: room.slug, id },
        })
        let entries = await expectBookInLine(room)
        expect(entries.map((entry) => entry.kind)).toEqual(['record', 'reversal'])

        await call(restoreExpense as Handler, {
            path: `/api/rooms/${room.slug}/expenses/${id}/restore`,
            method: 'POST',
            params: { slug: room.slug, id },
        })
        entries = await expectBookInLine(room)
        expect(entries.map((entry) => entry.kind)).toEqual(['record', 'reversal', 'record'])
    })

    it('cancels a deleted payment', async () => {
        const room = await makeRoom()
        await addExpense(room, room.ana, '900')
        const paid = await pay(room, room.bruno, room.ana, '300')
        const id = paid.body.settlements[0].id
        await call(deleteSettlement as Handler, {
            path: `/api/rooms/${room.slug}/settlements/${id}`,
            method: 'DELETE',
            params: { slug: room.slug, id },
        })
        const entries = await expectBookInLine(room)
        expect(entries.at(-1)).toMatchObject({ sourceType: 'settlement', kind: 'reversal' })
    })

    it('keeps the vaquita’s money in its own account', async () => {
        const room = await makeRoom()
        const created = await call(postPot as Handler, {
            path: `/api/rooms/${room.slug}/pots`,
            method: 'POST',
            params: { slug: room.slug },
            body: { name: 'Viaje', keeperId: room.ana },
        })
        const potId = created.body.pots![0].id
        for (const member of [room.ana, room.bruno, room.abu]) {
            await call(postContribution as Handler, {
                path: `/api/rooms/${room.slug}/pots/${potId}/contributions`,
                method: 'POST',
                params: { slug: room.slug, potId },
                body: { memberId: member, amountMinor: '500' },
            })
        }
        const expense = await addExpense(room, room.ana, '600')
        await call(linkExpense as Handler, {
            path: `/api/rooms/${room.slug}/pots/${potId}/expenses`,
            method: 'POST',
            params: { slug: room.slug, potId },
            body: { expenseId: expense.body.expenses[0].id },
        })
        await expectBookInLine(room)
        const pot = await prisma.ledgerPosting.aggregate({
            where: { roomId: room.roomId, accountType: 'pot', accountId: potId },
            _sum: { amountMinor: true },
        })
        expect(pot._sum.amountMinor).toBe(900n)
        const keeper = await prisma.ledgerPosting.aggregate({
            where: { roomId: room.roomId, accountType: 'keeper', accountId: room.ana },
            _sum: { amountMinor: true },
        })
        expect(keeper._sum.amountMinor).toBe(-900n)
    })

    it('serves balances from the book and lists movements newest first', async () => {
        const room = await makeRoom()
        await addExpense(room, room.ana, '900')
        await pay(room, room.bruno, room.ana, '300')
        const state = await call(getRoom as Handler, {
            path: `/api/rooms/${room.slug}`,
            params: { slug: room.slug },
        })
        expect(state.body.balances).toEqual({ [room.ana]: '300', [room.bruno]: '0', [room.abu]: '-300' })
        const page = await roomLedgerBySlug(room.slug)
        expect(page.entries.map((entry) => entry.sourceType)).toEqual(['settlement', 'expense'])
        expect(page.entries[0].detail).toMatchObject({ fromId: room.bruno, toId: room.ana })
    })

    it('refuses to change, delete or unbalance the book', async () => {
        const room = await makeRoom()
        await addExpense(room, room.ana, '900')
        const entry = await prisma.ledgerEntry.findFirstOrThrow({ where: { roomId: room.roomId } })
        await expect(
            prisma.ledgerEntry.update({ where: { id: entry.id }, data: { description: 'otra cosa' } })
        ).rejects.toThrow(/append-only/)
        await expect(prisma.ledgerPosting.deleteMany({ where: { entryId: entry.id } })).rejects.toThrow(/append-only/)
        await expect(
            prisma.ledgerEntry.create({
                data: {
                    roomId: room.roomId,
                    sourceType: 'expense',
                    sourceId: 'x',
                    kind: 'record',
                    currency: 'USD',
                    occurredAt: new Date(),
                    postings: {
                        create: [{ roomId: room.roomId, accountType: 'member', accountId: room.ana, amountMinor: 5n }],
                    },
                },
            })
        ).rejects.toThrow(/does not balance/)
    })
})

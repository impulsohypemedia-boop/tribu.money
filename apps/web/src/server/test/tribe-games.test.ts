/**
 * Ruleta, apuestas y multas against the real handlers and database. None of them may invent
 * money: every case checks the balances still sum to zero and say what really happened.
 */
import { beforeEach, describe, expect, it } from 'vitest'
import { truncateAll } from '@/server/test/db'
import { resetEvents } from '@/server/events'
import { resetRateLimits } from '@/server/rateLimit'
import { POST as postRoom } from '@/app/api/rooms/route'
import { POST as postMember } from '@/app/api/rooms/[slug]/members/route'
import { POST as postPot } from '@/app/api/rooms/[slug]/pots/route'
import { PATCH as patchPot } from '@/app/api/rooms/[slug]/pots/[potId]/route'
import { POST as postContribution } from '@/app/api/rooms/[slug]/pots/[potId]/contributions/route'
import { POST as postDraw } from '@/app/api/rooms/[slug]/draws/route'
import { POST as postSpin } from '@/app/api/rooms/[slug]/draws/[drawId]/spin/route'
import { POST as postBet } from '@/app/api/rooms/[slug]/bets/route'
import { POST as postBetAction } from '@/app/api/rooms/[slug]/bets/[betId]/route'
import { POST as postFine } from '@/app/api/rooms/[slug]/fines/route'
import { POST as postFineAction } from '@/app/api/rooms/[slug]/fines/[fineId]/route'
import type { ApiError, RoomState, RoomStateWithMember } from '@/lib/api-types'
import { sha256Hex, verifyDraw } from '@/lib/roulette'

type Params = Record<string, string>
type Handler = (request: Request, ctx: { params: Promise<Params> }) => Promise<Response>
type Reply = RoomState & ApiError & { id: string; seedHash: string }

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

const total = (balances: Record<string, string>) => Object.values(balances).reduce((sum, v) => sum + BigInt(v), 0n)

beforeEach(async () => {
    await truncateAll()
    resetRateLimits()
    resetEvents()
})

describe('la ruleta', () => {
    const spin = (room: Room, drawId: string, body: Record<string, unknown>) =>
        call(postSpin as Handler, {
            path: `/api/rooms/${room.slug}/draws/${drawId}/spin`,
            params: { slug: room.slug, drawId },
            body,
            token: room.ana.token,
        })

    it('puts the whole bill on one person, and the proof checks out', async () => {
        const room = await makeRoom()
        const started = await call(postDraw as Handler, { path: '', params: { slug: room.slug } })
        expect(started.status).toBe(201)
        const people = [room.ana.id, room.bruno.id, room.cami.id]
        const res = await spin(room, started.body.id, {
            clientSeed: 'a1b2c3d4e5f60718',
            participantIds: people,
            paidById: room.ana.id,
            amountMinor: '9000',
            description: 'Cena',
        })
        expect(res.status).toBe(201)
        const draw = res.body.draws![0]
        expect(draw.seedHash).toBe(started.body.seedHash)
        expect(await sha256Hex(draw.seed)).toBe(draw.seedHash)
        expect(await verifyDraw(draw)).toBe(true)
        const expense = res.body.expenses.find((e) => e.id === draw.id)!
        expect(expense.paidById).toBe(room.ana.id)
        expect(expense.shares.filter((s) => s.amountMinor !== '0')).toEqual([
            expect.objectContaining({ memberId: draw.winnerId, amountMinor: '9000' }),
        ])
        const expected = draw.winnerId === room.ana.id ? '0' : '9000'
        expect(res.body.balances[room.ana.id]).toBe(expected)
        expect(total(res.body.balances)).toBe(0n)
    })

    it('spins once only, and with at least two people', async () => {
        const room = await makeRoom()
        const started = await call(postDraw as Handler, { path: '', params: { slug: room.slug } })
        const body = {
            clientSeed: 'a1b2c3d4e5f60718',
            participantIds: [room.ana.id],
            paidById: room.ana.id,
            amountMinor: '100',
            description: '',
        }
        expect((await spin(room, started.body.id, body)).status).toBe(400)
        const ok = await spin(room, started.body.id, { ...body, participantIds: [room.ana.id, room.bruno.id] })
        expect(ok.status).toBe(201)
        const again = await spin(room, started.body.id, { ...body, participantIds: [room.ana.id, room.bruno.id] })
        expect(again.body.error.code).toBe('DRAW_ALREADY_SPUN')
    })
})

describe('apuestas', () => {
    const bet = (room: Room, token: string, body: Record<string, unknown>) =>
        call(postBet as Handler, { path: '', params: { slug: room.slug }, body, token })
    const act = (room: Room, token: string, betId: string, body: Record<string, unknown>) =>
        call(postBetAction as Handler, { path: '', params: { slug: room.slug, betId }, body, token })

    it('turns a settled bet into what the loser passes the winner', async () => {
        const room = await makeRoom()
        const created = await bet(room, room.ana.token, {
            title: 'Si Boca pierde',
            amountMinor: '5000',
            rivalId: room.bruno.id,
        })
        expect(created.status).toBe(201)
        const id = created.body.bets![0].id
        expect((await act(room, room.ana.token, id, { action: 'accept' })).body.error.code).toBe(
            'BET_ACTION_NOT_ALLOWED'
        )
        expect((await act(room, room.bruno.token, id, { action: 'accept' })).status).toBe(200)
        expect((await act(room, room.cami.token, id, { action: 'claim', winnerId: room.cami.id })).status).toBe(409)
        await act(room, room.ana.token, id, { action: 'claim', winnerId: room.ana.id })
        // The one who claimed cannot also confirm.
        expect((await act(room, room.ana.token, id, { action: 'confirm' })).status).toBe(409)
        const done = await act(room, room.bruno.token, id, { action: 'confirm' })
        expect(done.status).toBe(200)
        expect(done.body.bets![0]).toMatchObject({ status: 'resolved', winnerId: room.ana.id })
        expect(done.body.balances[room.ana.id]).toBe('5000')
        expect(done.body.balances[room.bruno.id]).toBe('-5000')
        expect(total(done.body.balances)).toBe(0n)
    })

    it('needs a member token and someone else to bet with', async () => {
        const room = await makeRoom()
        const anonymous = await call(postBet as Handler, {
            path: '',
            params: { slug: room.slug },
            body: { title: 'x', amountMinor: '1', rivalId: room.bruno.id },
        })
        expect(anonymous.body.error.code).toBe('MEMBER_TOKEN_REQUIRED')
        const self = await bet(room, room.ana.token, { title: 'x', amountMinor: '1', rivalId: room.ana.id })
        expect(self.body.error.code).toBe('BET_SAME_PERSON')
    })

    it('a disputed claim goes back, and a cancelled bet moves no money', async () => {
        const room = await makeRoom()
        const id = (await bet(room, room.ana.token, { title: 'x', amountMinor: '100', rivalId: room.bruno.id })).body
            .bets![0].id
        await act(room, room.bruno.token, id, { action: 'accept' })
        await act(room, room.ana.token, id, { action: 'claim', winnerId: room.ana.id })
        const disputed = await act(room, room.bruno.token, id, { action: 'dispute' })
        expect(disputed.body.bets![0].status).toBe('accepted')
        const cancelled = await act(room, room.bruno.token, id, { action: 'cancel' })
        expect(cancelled.body.bets![0].status).toBe('cancelled')
        expect(cancelled.body.expenses).toHaveLength(0)
    })
})

describe('multas', () => {
    const fine = (room: Room, token: string, body: Record<string, unknown>) =>
        call(postFine as Handler, { path: '', params: { slug: room.slug }, body, token })
    const act = (room: Room, token: string, fineId: string, body: Record<string, unknown>) =>
        call(postFineAction as Handler, { path: '', params: { slug: room.slug, fineId }, body, token })

    it('needs a pot, a vote, and then lands in the pot as the fined person’s payment', async () => {
        const room = await makeRoom()
        const noPot = await fine(room, room.ana.token, {
            memberId: room.cami.id,
            reason: 'Llegó tarde',
            amountMinor: '100',
        })
        expect(noPot.body.error.code).toBe('POT_NOT_FOUND')
        const pot = await call(postPot as Handler, {
            path: '',
            params: { slug: room.slug },
            body: { name: 'Pozo de la tribu', keeperId: room.ana.id },
        })
        const potId = pot.body.pots![0].id

        const proposed = await fine(room, room.bruno.token, {
            memberId: room.cami.id,
            reason: 'Llegó tarde',
            amountMinor: '100',
        })
        const id = proposed.body.fines![0].id
        // Bruno proposed it, so his yes is in; Cami does not vote on her own fine.
        expect(proposed.body.fines![0]).toMatchObject({ status: 'voting', votes: { [room.bruno.id]: true } })
        expect((await act(room, room.cami.token, id, { action: 'vote', vote: false })).body.error.code).toBe(
            'FINE_NOT_A_VOTER'
        )
        expect((await act(room, room.cami.token, id, { action: 'pay' })).body.error.code).toBe('FINE_NOT_APPROVED')
        const approved = await act(room, room.ana.token, id, { action: 'vote', vote: true })
        expect(approved.body.fines![0].status).toBe('approved')

        const paid = await act(room, room.cami.token, id, { action: 'pay' })
        expect(paid.body.fines![0].status).toBe('paid')
        const contribution = paid.body.pots![0].contributions[0]
        expect(contribution).toMatchObject({ memberId: room.cami.id, amountMinor: '100', reason: 'fine' })
        expect(paid.body.balances[room.cami.id]).toBe('100')
        expect(paid.body.balances[room.ana.id]).toBe('-100')
        expect(total(paid.body.balances)).toBe(0n)
        expect((await act(room, room.cami.token, id, { action: 'pay' })).status).toBe(409)
        expect(paid.body.pots![0].id).toBe(potId)
    })

    it('is rejected once a majority says no', async () => {
        const room = await makeRoom()
        await call(postPot as Handler, {
            path: '',
            params: { slug: room.slug },
            body: { name: 'Pozo', keeperId: room.ana.id },
        })
        const id = (await fine(room, room.ana.token, { memberId: room.cami.id, reason: 'Faltó', amountMinor: '100' }))
            .body.fines![0].id
        const rejected = await act(room, room.bruno.token, id, { action: 'vote', vote: false })
        // Two voters (Ana, Bruno): one yes and one no cannot reach a majority of two.
        expect(rejected.body.fines![0].status).toBe('rejected')
    })
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

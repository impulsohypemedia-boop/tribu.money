/**
 * Member profiles against the real handler and database: the honored-guest flag, which anyone in
 * the room may flip, and payout details, which only the member themself may set. Also paying
 * ahead, which turns the extra into credit that later expenses use up.
 */
import { beforeEach, describe, expect, it } from 'vitest'
import { truncateAll } from '@/server/test/db'
import { resetEvents } from '@/server/events'
import { resetRateLimits } from '@/server/rateLimit'
import { POST as postRoom } from '@/app/api/rooms/route'
import { POST as postMember } from '@/app/api/rooms/[slug]/members/route'
import { PATCH as patchProfile } from '@/app/api/rooms/[slug]/members/[memberId]/profile/route'
import { POST as postExpense } from '@/app/api/rooms/[slug]/expenses/route'
import { POST as postSettlement } from '@/app/api/rooms/[slug]/settlements/route'
import type { ApiError, RoomState, RoomStateWithMember } from '@/lib/api-types'

const BASE = 'http://localhost'
type Params = Record<string, string>
type Handler = (request: Request, ctx: { params: Promise<Params> }) => Promise<Response>

const call = async <T>(
    handler: Handler,
    opts: { path: string; method?: string; body?: unknown; params?: Params; token?: string }
): Promise<{ status: number; body: T }> => {
    const request = new Request(`${BASE}${opts.path}`, {
        method: opts.method ?? 'GET',
        headers: {
            'Content-Type': 'application/json',
            ...(opts.token ? { 'X-Member-Token': opts.token } : {}),
        },
        body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
    })
    const res = await handler(request, { params: Promise.resolve(opts.params ?? {}) })
    return { status: res.status, body: (await res.json()) as T }
}

async function makeRoom() {
    const { body: created } = await call<RoomStateWithMember>(postRoom as Handler, {
        path: '/api/rooms',
        method: 'POST',
        body: { name: 'Familia', emoji: 'ski', currency: 'USD', creatorName: 'Ana' },
    })
    const slug = created.room.slug
    const join = async (name: string) =>
        (
            await call<RoomStateWithMember>(postMember as Handler, {
                path: `/api/rooms/${slug}/members`,
                method: 'POST',
                params: { slug },
                body: { name },
            })
        ).body
    const bruno = await join('Bruno')
    const abu = await join('Abu')
    return {
        slug,
        ana: { id: created.memberId, token: created.memberToken },
        bruno: { id: bruno.memberId, token: bruno.memberToken },
        abu: { id: abu.memberId, token: abu.memberToken },
    }
}

const patch = (slug: string, memberId: string, body: unknown, token?: string) =>
    call<RoomState & ApiError>(patchProfile as Handler, {
        path: `/api/rooms/${slug}/members/${memberId}/profile`,
        method: 'PATCH',
        params: { slug, memberId },
        body,
        token,
    })

const EVM = '0xAbCdEf0123456789abcdef0123456789ABCDEF01'

beforeEach(async () => {
    await truncateAll()
    resetRateLimits()
    resetEvents()
})

describe('payout details', () => {
    it('lets a member save their own wallet, stored lowercase', async () => {
        const room = await makeRoom()
        const res = await patch(
            room.slug,
            room.ana.id,
            { payout: { token: 'USDT', network: 'polygon', address: EVM } },
            room.ana.token
        )
        expect(res.status).toBe(200)
        const ana = res.body.members.find((member) => member.id === room.ana.id)
        expect(ana).toMatchObject({ payoutToken: 'USDT', payoutNetwork: 'polygon', payoutAddress: EVM.toLowerCase() })
    })

    it('refuses to set somebody else’s wallet', async () => {
        const room = await makeRoom()
        const withoutToken = await patch(room.slug, room.ana.id, {
            payout: { token: 'USDT', network: 'polygon', address: EVM },
        })
        expect(withoutToken.status).toBe(403)
        const asBruno = await patch(
            room.slug,
            room.ana.id,
            { payout: { token: 'USDT', network: 'polygon', address: EVM } },
            room.bruno.token
        )
        expect(asBruno.status).toBe(403)
        expect(asBruno.body.error.code).toBe('NOT_THIS_MEMBER')
    })

    it('refuses an address that does not fit the network, and an unknown token', async () => {
        const room = await makeRoom()
        const tronOnPolygon = await patch(
            room.slug,
            room.ana.id,
            { payout: { token: 'USDT', network: 'polygon', address: 'TJRabPrwbZy45sbavfcjinPJC18kjpRTv8' } },
            room.ana.token
        )
        expect(tronOnPolygon.status).toBe(400)
        expect(tronOnPolygon.body.error.code).toBe('PAYOUT_ADDRESS_INVALID')
        const dai = await patch(
            room.slug,
            room.ana.id,
            { payout: { token: 'DAI', network: 'polygon', address: EVM } },
            room.ana.token
        )
        expect(dai.status).toBe(400)
    })

    it('clears the wallet with null', async () => {
        const room = await makeRoom()
        await patch(
            room.slug,
            room.ana.id,
            { payout: { token: 'USDC', network: 'base', address: EVM } },
            room.ana.token
        )
        const cleared = await patch(room.slug, room.ana.id, { payout: null }, room.ana.token)
        expect(cleared.body.members.find((member) => member.id === room.ana.id)?.payoutAddress).toBeNull()
    })
    it('saves a bank alias or CBU and a Lemon tag, and clears them', async () => {
        const room = await makeRoom()
        const saved = await patch(
            room.slug,
            room.ana.id,
            { bank: '0000003100 0123456789 01', lemonTag: '@Ana.Tribu' },
            room.ana.token
        )
        expect(saved.status).toBe(200)
        const ana = saved.body.members.find((member) => member.id === room.ana.id)
        expect(ana).toMatchObject({ payoutBank: '0000003100012345678901', payoutLemonTag: 'ana.tribu' })

        const alias = await patch(room.slug, room.ana.id, { bank: 'ana.tribu.mp' }, room.ana.token)
        const afterAlias = alias.body.members.find((member) => member.id === room.ana.id)
        expect(afterAlias).toMatchObject({ payoutBank: 'ana.tribu.mp', payoutLemonTag: 'ana.tribu' })

        const cleared = await patch(room.slug, room.ana.id, { bank: null, lemonTag: '' }, room.ana.token)
        const afterClear = cleared.body.members.find((member) => member.id === room.ana.id)
        expect(afterClear).toMatchObject({ payoutBank: null, payoutLemonTag: null })
    })

    it('refuses a bad alias or tag, and somebody else’s bank details', async () => {
        const room = await makeRoom()
        const badBank = await patch(room.slug, room.ana.id, { bank: '12345' }, room.ana.token)
        expect(badBank.status).toBe(400)
        expect(badBank.body.error.code).toBe('PAYOUT_BANK_INVALID')
        const badTag = await patch(room.slug, room.ana.id, { lemonTag: 'ana tribu' }, room.ana.token)
        expect(badTag.body.error.code).toBe('PAYOUT_LEMON_TAG_INVALID')
        const asBruno = await patch(room.slug, room.ana.id, { bank: 'ana.tribu.mp' }, room.bruno.token)
        expect(asBruno.status).toBe(403)
    })
})

describe('honored guests', () => {
    it('can be marked by anyone in the room and are left out of default splits', async () => {
        const room = await makeRoom()
        const marked = await patch(room.slug, room.abu.id, { honoredGuest: true })
        expect(marked.status).toBe(200)
        expect(marked.body.members.find((member) => member.id === room.abu.id)?.honoredGuest).toBe(true)

        const expense = await call<RoomState>(postExpense as Handler, {
            path: `/api/rooms/${room.slug}/expenses`,
            method: 'POST',
            params: { slug: room.slug },
            body: {
                description: 'Súper',
                amountMinor: '1000',
                currency: 'USD',
                paidById: room.ana.id,
                splitMode: 'EQUAL',
            },
        })
        expect(expense.status).toBe(201)
        const shares = expense.body.expenses[0].shares
        expect(shares.map((share) => share.memberId).sort()).toEqual([room.ana.id, room.bruno.id].sort())
        expect(expense.body.balances[room.abu.id]).toBe('0')
    })

    it('still join an expense when picked by hand', async () => {
        const room = await makeRoom()
        await patch(room.slug, room.abu.id, { honoredGuest: true })
        const expense = await call<RoomState>(postExpense as Handler, {
            path: `/api/rooms/${room.slug}/expenses`,
            method: 'POST',
            params: { slug: room.slug },
            body: {
                description: 'Cumple',
                amountMinor: '900',
                currency: 'USD',
                paidById: room.ana.id,
                splitMode: 'EQUAL',
                participantIds: [room.ana.id, room.bruno.id, room.abu.id],
            },
        })
        expect(expense.body.expenses[0].shares).toHaveLength(3)
    })
})

describe('paying ahead', () => {
    const addExpense = (slug: string, paidById: string, amountMinor: string) =>
        call<RoomState>(postExpense as Handler, {
            path: `/api/rooms/${slug}/expenses`,
            method: 'POST',
            params: { slug },
            body: { description: 'Netflix', amountMinor, currency: 'USD', paidById, splitMode: 'EQUAL' },
        })
    const settle = (slug: string, body: Record<string, unknown>) =>
        call<RoomState & ApiError>(postSettlement as Handler, {
            path: `/api/rooms/${slug}/settlements`,
            method: 'POST',
            params: { slug },
            body,
        })

    it('keeps the debt as a ceiling unless the payer says it is on purpose', async () => {
        const room = await makeRoom()
        await addExpense(room.slug, room.ana.id, '900') // each owes Ana 300
        const typo = await settle(room.slug, { fromId: room.bruno.id, toId: room.ana.id, amountMinor: '3000' })
        expect(typo.status).toBe(400)
        expect(typo.body.error.code).toBe('SETTLEMENT_EXCEEDS_DEBT')
    })

    it('records the extra as credit, and the next expenses use it up', async () => {
        const room = await makeRoom()
        await addExpense(room.slug, room.ana.id, '900')
        const ahead = await settle(room.slug, {
            fromId: room.bruno.id,
            toId: room.ana.id,
            amountMinor: '1200',
            advance: true,
        })
        expect(ahead.status).toBe(201)
        // Bruno owed 300 and paid 1200: 900 in his favour.
        expect(ahead.body.balances[room.bruno.id]).toBe('900')

        // Three more months at 900 split three ways: 300 each, all from Bruno's credit.
        for (let month = 0; month < 3; month++) await addExpense(room.slug, room.ana.id, '900')
        const after = await addExpense(room.slug, room.ana.id, '3')
        expect(after.status).toBe(201)
        const final = after.body.balances
        // 900 credit - 3 x 300 = 0, then the 3-cent expense: Bruno owes 1.
        expect(final[room.bruno.id]).toBe('-1')
        const total = Object.values(final).reduce((sum, value) => sum + BigInt(value), 0n)
        expect(total).toBe(0n)
    })

    it('records a crypto payment with its token and network', async () => {
        const room = await makeRoom()
        await addExpense(room.slug, room.ana.id, '900')
        const paid = await settle(room.slug, {
            fromId: room.bruno.id,
            toId: room.ana.id,
            amountMinor: '300',
            method: 'crypto',
            crypto: { token: 'USDT', network: 'tron' },
        })
        expect(paid.status).toBe(201)
        expect(paid.body.settlements[0]).toMatchObject({
            method: 'crypto',
            token: 'USDT',
            network: 'tron',
            txHash: null,
        })
        const bad = await settle(room.slug, {
            fromId: room.abu.id,
            toId: room.ana.id,
            amountMinor: '300',
            method: 'crypto',
            crypto: { token: 'USDT', network: 'solana' },
        })
        expect(bad.status).toBe(400)
    })

    it('can pay ahead even when nothing is owed yet', async () => {
        const room = await makeRoom()
        const ahead = await settle(room.slug, {
            fromId: room.bruno.id,
            toId: room.ana.id,
            amountMinor: '600',
            advance: true,
        })
        expect(ahead.status).toBe(201)
        expect(ahead.body.balances[room.bruno.id]).toBe('600')
        expect(ahead.body.balances[room.ana.id]).toBe('-600')
    })
})

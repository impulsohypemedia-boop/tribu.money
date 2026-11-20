/**
 * Member profiles against the real handler and database: the honored-guest flag, which anyone in
 * the room may flip, and payout details, which only the member themself may set.
 */
import { beforeEach, describe, expect, it } from 'vitest'
import { truncateAll } from '@/server/test/db'
import { resetEvents } from '@/server/events'
import { resetRateLimits } from '@/server/rateLimit'
import { POST as postRoom } from '@/app/api/rooms/route'
import { POST as postMember } from '@/app/api/rooms/[slug]/members/route'
import { PATCH as patchProfile } from '@/app/api/rooms/[slug]/members/[memberId]/profile/route'
import { POST as postExpense } from '@/app/api/rooms/[slug]/expenses/route'
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

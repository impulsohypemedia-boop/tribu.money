/** The badge voucher: only for a badge earned in the room, only to a linked wallet, and it verifies. */
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { verifyTypedData } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { prisma, truncateAll } from '@/server/test/db'
import { resetRateLimits } from '@/server/rateLimit'
import { POST as postRoom } from '@/app/api/rooms/route'
import { POST as postPot } from '@/app/api/rooms/[slug]/pots/route'
import { POST as postVoucher } from '@/app/api/rooms/[slug]/badges/route'
import type { RoomStateWithMember } from '@/lib/api-types'

const KEY = `0x${'11'.repeat(32)}` as const
const CONTRACT = '0x00000000000000000000000000000000000000b1'
const WALLET = '0x00000000000000000000000000000000000000a1'

type Handler = (request: Request, ctx: { params: Promise<Record<string, string>> }) => Promise<Response>
const post = async (handler: Handler, params: Record<string, string>, body: unknown, token?: string) => {
    const res = await handler(
        new Request('http://localhost/x', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...(token ? { 'X-Member-Token': token } : {}) },
            body: JSON.stringify(body),
        }),
        { params: Promise.resolve(params) }
    )
    return { status: res.status, body: await res.json() }
}

beforeEach(async () => {
    await truncateAll()
    resetRateLimits()
    process.env.TRIBU_BADGE_SIGNER_KEY = KEY
    process.env.NEXT_PUBLIC_TRIBU_BADGES_ADDRESS = CONTRACT
})
afterEach(() => {
    delete process.env.TRIBU_BADGE_SIGNER_KEY
    delete process.env.NEXT_PUBLIC_TRIBU_BADGES_ADDRESS
})

describe('badge voucher', () => {
    it('signs an earned badge for the linked wallet, and nothing else', async () => {
        const room = (await post(postRoom as Handler, {}, { name: 'Casa', currency: 'USD', creatorName: 'Ana' }))
            .body as RoomStateWithMember
        const slug = room.room.slug
        const ask = (badge: string) => post(postVoucher as Handler, { slug }, { badge }, room.memberToken)

        expect((await ask('keeper')).body.error.code).toBe('BADGE_NO_WALLET')
        await prisma.member.update({ where: { id: room.memberId }, data: { walletAddress: WALLET } })
        expect((await ask('keeper')).body.error.code).toBe('BADGE_NOT_EARNED')

        await post(postPot as Handler, { slug }, { name: 'Pozo', keeperId: room.memberId })
        const res = await ask('keeper')
        expect(res.status).toBe(200)
        const valid = await verifyTypedData({
            address: privateKeyToAccount(KEY).address,
            domain: { name: 'TribuBadges', version: '1', chainId: 137, verifyingContract: CONTRACT },
            types: {
                Mint: [
                    { name: 'to', type: 'address' },
                    { name: 'id', type: 'uint256' },
                ],
            },
            primaryType: 'Mint',
            message: { to: WALLET, id: 3n },
            signature: res.body.signature,
        })
        expect(valid).toBe(true)
        expect((await ask('rounder')).body.error.code).toBe('BADGE_NOT_EARNED')
    })

    it('is off until the contract and key are set', async () => {
        delete process.env.TRIBU_BADGE_SIGNER_KEY
        const room = (await post(postRoom as Handler, {}, { name: 'Casa', currency: 'USD', creatorName: 'Ana' }))
            .body as RoomStateWithMember
        const res = await post(postVoucher as Handler, { slug: room.room.slug }, { badge: 'keeper' }, room.memberToken)
        expect(res.status).toBe(503)
    })
})

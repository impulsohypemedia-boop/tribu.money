/**
 * Lemon wallets and on-chain settlements, through the real route handlers and database. The chain
 * is the only thing faked: signatures are real (viem, a throwaway key) and receipts are built here.
 */
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { encodeAbiParameters, encodeEventTopics, parseAbi, verifyMessage } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { createSiweMessage } from 'viem/siwe'
import { prisma, truncateAll } from '@/server/test/db'
import { resetRateLimits } from '@/server/rateLimit'
import { lemonNetwork } from '@/lib/lemon/chain'
import { mintNonce } from '@/server/lemon/identity'
import type { ReceiptLike } from '@/server/lemon/payment'
import type { ApiError, RoomState, RoomStateWithMember } from '@/lib/api-types'

const receipts = new Map<string, ReceiptLike>()

vi.mock('@/server/lemon/rpc', () => ({
    chainClient: () => ({
        verifyMessage: (input: Parameters<typeof verifyMessage>[0]) => verifyMessage(input),
        getTransactionReceipt: async ({ hash }: { hash: string }) => {
            const receipt = receipts.get(hash.toLowerCase())
            if (!receipt) throw Object.assign(new Error('not found'), { name: 'TransactionReceiptNotFoundError' })
            return receipt
        },
    }),
}))

const { POST: postRoom } = await import('@/app/api/rooms/route')
const { POST: postMember } = await import('@/app/api/rooms/[slug]/members/route')
const { POST: postExpense } = await import('@/app/api/rooms/[slug]/expenses/route')
const { POST: postSettlement } = await import('@/app/api/rooms/[slug]/settlements/route')
const { POST: linkWallet } = await import('@/app/api/rooms/[slug]/members/[memberId]/wallet/route')
const { GET: getQuote } = await import('@/app/api/rooms/[slug]/lemon-quote/route')

type Params = Record<string, string>
type Handler = (request: Request, ctx: { params: Promise<Params> }) => Promise<Response>

const call = async <T>(
    handler: Handler,
    opts: { path: string; method?: string; body?: unknown; params?: Params; token?: string }
): Promise<{ status: number; body: T }> => {
    const request = new Request(`http://localhost${opts.path}`, {
        method: opts.method ?? 'GET',
        headers: { 'Content-Type': 'application/json', ...(opts.token ? { 'X-Member-Token': opts.token } : {}) },
        body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
    })
    const res = await handler(request, { params: Promise.resolve(opts.params ?? {}) })
    return { status: res.status, body: (await res.json()) as T }
}

const ana = privateKeyToAccount('0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d')
const bea = privateKeyToAccount('0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a')
const USDC = lemonNetwork().tokens.USDC!
const transferAbi = parseAbi(['event Transfer(address indexed from, address indexed to, uint256 value)'])

async function proofFor(account: typeof ana) {
    const message = createSiweMessage({
        address: account.address,
        chainId: lemonNetwork().chainId,
        domain: 'tribu.money',
        nonce: mintNonce(),
        uri: 'https://tribu.money',
        version: '1',
    })
    return { wallet: account.address, message, signature: await account.signMessage({ message }) }
}

function mined(hash: string, from: string, to: string, value: bigint) {
    receipts.set(hash, {
        status: 'success',
        logs: [
            {
                address: USDC.address,
                topics: encodeEventTopics({
                    abi: transferAbi,
                    eventName: 'Transfer',
                    args: { from: from as `0x${string}`, to: to as `0x${string}` },
                }) as [`0x${string}`, ...`0x${string}`[]],
                data: encodeAbiParameters([{ type: 'uint256' }], [value]),
            },
        ],
    })
}

const hash = (n: number) => `0x${n.toString(16).padStart(64, '0')}`

/** A USD room where Bea owes Ana 10.00, with both phones' identities. */
async function room() {
    const created = await call<RoomStateWithMember>(postRoom as Handler, {
        path: '/api/rooms',
        method: 'POST',
        body: { name: 'Asado', emoji: '🔥', currency: 'USD', creatorName: 'Ana' },
    })
    const slug = created.body.room.slug
    const joined = await call<RoomStateWithMember>(postMember as Handler, {
        path: `/api/rooms/${slug}/members`,
        method: 'POST',
        params: { slug },
        body: { name: 'Bea' },
    })
    await call<RoomState>(postExpense as Handler, {
        path: `/api/rooms/${slug}/expenses`,
        method: 'POST',
        params: { slug },
        body: {
            description: 'Carne',
            amountMinor: '2000',
            currency: 'USD',
            paidById: created.body.memberId,
            splitMode: 'EQUAL',
        },
    })
    return {
        slug,
        ana: { id: created.body.memberId, token: created.body.memberToken },
        bea: { id: joined.body.memberId, token: joined.body.memberToken },
    }
}

const link = async (slug: string, member: { id: string; token: string }, account: typeof ana, token = member.token) =>
    call<RoomState | ApiError>(linkWallet as Handler, {
        path: `/api/rooms/${slug}/members/${member.id}/wallet`,
        method: 'POST',
        params: { slug, memberId: member.id },
        token,
        body: { ...(await proofFor(account)), lemonTag: account === ana ? 'ana' : 'bea' },
    })

const settle = (slug: string, from: string, to: string, body: Record<string, unknown>) =>
    call<RoomState | ApiError>(postSettlement as Handler, {
        path: `/api/rooms/${slug}/settlements`,
        method: 'POST',
        params: { slug },
        body: { fromId: from, toId: to, amountMinor: '1000', method: 'lemon', ...body },
    })

beforeEach(async () => {
    await truncateAll()
    resetRateLimits()
    receipts.clear()
})
afterEach(() => resetRateLimits())
afterAll(async () => {
    await prisma.$disconnect()
})

describe('linking a Lemon wallet', () => {
    it('links the signed wallet to the member holding that member’s token', async () => {
        const r = await room()
        const linked = await link(r.slug, r.ana, ana)
        expect(linked.status).toBe(200)
        const member = (linked.body as RoomState).members.find((m) => m.id === r.ana.id)
        expect(member?.walletAddress).toBe(ana.address.toLowerCase())
        expect(member?.lemonTag).toBe('ana')
    })

    it('refuses to set someone else’s wallet, even with a valid signature', async () => {
        const r = await room()
        const hijack = await link(r.slug, r.ana, bea, r.bea.token)
        expect(hijack.status).toBe(403)
        expect((hijack.body as ApiError).error.code).toBe('NOT_THIS_MEMBER')
        const row = await prisma.member.findUnique({ where: { id: r.ana.id } })
        expect(row?.walletAddress).toBeNull()
    })

    it('refuses a wallet the caller cannot sign for', async () => {
        const r = await room()
        const proof = await proofFor(bea)
        const res = await call<ApiError>(linkWallet as Handler, {
            path: `/api/rooms/${r.slug}/members/${r.ana.id}/wallet`,
            method: 'POST',
            params: { slug: r.slug, memberId: r.ana.id },
            token: r.ana.token,
            body: { ...proof, wallet: ana.address },
        })
        expect(res.status).toBe(400)
        expect(res.body.error.code).toBe('LEMON_PROOF_INVALID')
    })
})

describe('settling with Lemon', () => {
    it('quotes a USD debt in stablecoin base units', async () => {
        const r = await room()
        const res = await call<{ quotes: { token: string; tokenAmount: string }[] }>(getQuote as Handler, {
            path: `/api/rooms/${r.slug}/lemon-quote?amountMinor=1000`,
            params: { slug: r.slug },
        })
        expect(res.status).toBe(200)
        expect(res.body.quotes).toEqual(
            expect.arrayContaining([
                expect.objectContaining({ token: 'USDC', tokenAmount: '10000000' }),
                expect.objectContaining({ token: 'USDT', tokenAmount: '10000000' }),
            ])
        )
    })

    it('records a payment the chain confirms, with its transaction', async () => {
        const r = await room()
        await link(r.slug, r.ana, ana)
        await link(r.slug, r.bea, bea)
        mined(hash(1), bea.address, ana.address, 10_000_000n)

        const res = await settle(r.slug, r.bea.id, r.ana.id, {
            lemon: { txHash: hash(1), token: 'USDC', tokenAmount: '10000000' },
        })
        expect(res.status).toBe(201)
        const state = res.body as RoomState
        expect(state.balances[r.bea.id]).toBe('0')
        expect(state.settlements[0]).toMatchObject({
            method: 'lemon',
            txHash: hash(1),
            token: 'USDC',
            tokenAmount: '10000000',
        })
    })

    it('records nothing while the transaction is unconfirmed, and says so retryably', async () => {
        const r = await room()
        await link(r.slug, r.ana, ana)
        await link(r.slug, r.bea, bea)
        const res = await settle(r.slug, r.bea.id, r.ana.id, {
            lemon: { txHash: hash(2), token: 'USDC', tokenAmount: '10000000' },
        })
        expect(res.status).toBe(409)
        expect((res.body as ApiError).error.code).toBe('LEMON_TX_PENDING')
        expect(await prisma.settlement.count()).toBe(0)
    })

    it('refuses to count one transaction twice', async () => {
        const r = await room()
        await link(r.slug, r.ana, ana)
        await link(r.slug, r.bea, bea)
        mined(hash(3), bea.address, ana.address, 10_000_000n)
        const lemon = { txHash: hash(3), token: 'USDC', tokenAmount: '5000000' }
        const first = await call<RoomState>(postSettlement as Handler, {
            path: `/api/rooms/${r.slug}/settlements`,
            method: 'POST',
            params: { slug: r.slug },
            body: { fromId: r.bea.id, toId: r.ana.id, amountMinor: '500', method: 'lemon', lemon },
        })
        expect(first.status).toBe(201)
        const replay = await call<ApiError>(postSettlement as Handler, {
            path: `/api/rooms/${r.slug}/settlements`,
            method: 'POST',
            params: { slug: r.slug },
            body: { fromId: r.bea.id, toId: r.ana.id, amountMinor: '500', method: 'lemon', lemon },
        })
        expect(replay.status).toBe(409)
        expect(replay.body.error.code).toBe('LEMON_TX_ALREADY_RECORDED')
    })

    it('refuses a transfer that went to another wallet', async () => {
        const r = await room()
        await link(r.slug, r.ana, ana)
        await link(r.slug, r.bea, bea)
        mined(hash(4), bea.address, '0x3333333333333333333333333333333333333333', 10_000_000n)
        const res = await settle(r.slug, r.bea.id, r.ana.id, {
            lemon: { txHash: hash(4), token: 'USDC', tokenAmount: '10000000' },
        })
        expect(res.status).toBe(400)
        expect((res.body as ApiError).error.code).toBe('LEMON_TX_MISMATCH')
    })

    it('needs a linked wallet on both sides', async () => {
        const r = await room()
        await link(r.slug, r.bea, bea)
        const res = await settle(r.slug, r.bea.id, r.ana.id, {
            lemon: { txHash: hash(5), token: 'USDC', tokenAmount: '10000000' },
        })
        expect(res.status).toBe(400)
        expect((res.body as ApiError).error.code).toBe('LEMON_WALLET_MISSING')
    })

    it('refuses a lemon settlement without its transaction', async () => {
        const r = await room()
        const res = await settle(r.slug, r.bea.id, r.ana.id, {})
        expect(res.status).toBe(400)
        expect((res.body as ApiError).error.code).toBe('LEMON_TX_INVALID')
    })
})

/**
 * A vaquita's real wallet, through the real route handlers and database. The chain is faked: a
 * map of TribuVaquita pots answers the same reads the contract would.
 */
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { verifyMessage } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { createSiweMessage } from 'viem/siwe'
import { prisma, truncateAll } from '@/server/test/db'
import { resetRateLimits } from '@/server/rateLimit'
import { lemonNetwork } from '@/lib/lemon/chain'
import { vaquitaWalletId } from '@/lib/lemon/vaquita'
import { mintNonce } from '@/server/lemon/identity'
import type { ApiError, ApiPotWallet, RoomState, RoomStateWithMember } from '@/lib/api-types'

const CONTRACT = '0x9999999999999999999999999999999999999999'
const AAVE_POOL = '0x7777777777777777777777777777777777777777'
const USDC = lemonNetwork().tokens.USDC!

type FakePot = {
    token: string
    earns?: boolean
    approvalsNeeded: bigint
    members: string[]
    parts: Record<string, bigint>
    proposals: {
        action: number
        target: string
        amount: bigint
        memo: string
        proposer: string
        executed: boolean
        cancelled: boolean
        approvedBy: string[]
    }[]
}
const chain = new Map<string, FakePot>()
const ZERO = '0x0000000000000000000000000000000000000000'

function answer(functionName: string, args: readonly unknown[]): unknown {
    const pot = chain.get(String(args[0]).toLowerCase())
    switch (functionName) {
        case 'getPot': {
            if (!pot) return [ZERO, false, 0n, 0n, []]
            const total = Object.values(pot.parts).reduce((a, b) => a + b, 0n)
            return [pot.token, pot.earns ?? false, pot.approvalsNeeded, total, pot.members]
        }
        case 'proposalCount':
            return BigInt(pot?.proposals.length ?? 0)
        case 'partOf':
            return pot?.parts[String(args[1]).toLowerCase()] ?? 0n
        case 'getProposal': {
            const p = pot!.proposals[Number(args[1])]
            return [p, BigInt(p.approvedBy.length)]
        }
        case 'hasApproved':
            return pot!.proposals[Number(args[1])].approvedBy.includes(String(args[2]).toLowerCase())
        case 'aavePool':
            return AAVE_POOL
        case 'getReserveData':
            // 4.25% a year, as a ray.
            return { currentLiquidityRate: 425n * 10n ** 23n }
        default:
            throw new Error(`unexpected read ${functionName}`)
    }
}

vi.mock('@/server/lemon/rpc', () => ({
    chainClient: () => ({
        verifyMessage: (input: Parameters<typeof verifyMessage>[0]) => verifyMessage(input),
        multicall: async ({ contracts }: { contracts: { functionName: string; args: readonly unknown[] }[] }) =>
            contracts.map((call) => answer(call.functionName, call.args)),
    }),
}))

vi.stubEnv('NEXT_PUBLIC_TRIBU_VAQUITA_ADDRESS', CONTRACT)

const { POST: postRoom } = await import('@/app/api/rooms/route')
const { POST: postMember } = await import('@/app/api/rooms/[slug]/members/route')
const { POST: linkWallet } = await import('@/app/api/rooms/[slug]/members/[memberId]/wallet/route')
const { POST: postPot } = await import('@/app/api/rooms/[slug]/pots/route')
const walletRoute = await import('@/app/api/rooms/[slug]/pots/[potId]/wallet/route')
const { POST: postNote } = await import('@/app/api/rooms/[slug]/pots/[potId]/wallet/notes/route')

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
const stranger = privateKeyToAccount('0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6')
const lower = (address: string) => address.toLowerCase()

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

/** A tribu where Ana and Bea linked wallets, with one vaquita. */
async function setup() {
    const created = await call<RoomStateWithMember>(postRoom as Handler, {
        path: '/api/rooms',
        method: 'POST',
        body: { name: 'Casa', emoji: '🏠', currency: 'USD', creatorName: 'Ana' },
    })
    const slug = created.body.room.slug
    const joined = await call<RoomStateWithMember>(postMember as Handler, {
        path: `/api/rooms/${slug}/members`,
        method: 'POST',
        params: { slug },
        body: { name: 'Bea' },
    })
    const members = [
        { id: created.body.memberId, token: created.body.memberToken, account: ana },
        { id: joined.body.memberId, token: joined.body.memberToken, account: bea },
    ]
    for (const member of members) {
        await call(linkWallet as Handler, {
            path: `/api/rooms/${slug}/members/${member.id}/wallet`,
            method: 'POST',
            params: { slug, memberId: member.id },
            token: member.token,
            body: await proofFor(member.account),
        })
    }
    const pot = await call<RoomState>(postPot as Handler, {
        path: `/api/rooms/${slug}/pots`,
        method: 'POST',
        params: { slug },
        token: members[0].token,
        body: { name: 'Alquiler', keeperId: members[0].id },
    })
    const potId = pot.body.pots![0].id
    return { slug, potId, ana: members[0], bea: members[1] }
}

const link = (slug: string, potId: string, creator: string, token?: string) =>
    call<RoomState | ApiError>(walletRoute.POST as Handler, {
        path: `/api/rooms/${slug}/pots/${potId}/wallet`,
        method: 'POST',
        params: { slug, potId },
        token,
        body: { creator },
    })

const read = (slug: string, potId: string) =>
    call<ApiPotWallet | ApiError>(walletRoute.GET as Handler, {
        path: `/api/rooms/${slug}/pots/${potId}/wallet`,
        params: { slug, potId },
    })

function putOnChain(creator: string, potId: string, pot: Partial<FakePot> = {}) {
    const id = vaquitaWalletId(lower(creator) as `0x${string}`, potId)
    chain.set(id, {
        token: USDC.address,
        approvalsNeeded: 2n,
        members: [ana.address, bea.address],
        parts: {},
        proposals: [],
        ...pot,
    })
    return id
}

beforeEach(async () => {
    await truncateAll()
    resetRateLimits()
    chain.clear()
})
afterEach(() => resetRateLimits())
afterAll(async () => {
    await prisma.$disconnect()
})

describe('creating a vaquita wallet', () => {
    it('points the pot at the wallet once the chain shows it', async () => {
        const r = await setup()
        const id = putOnChain(ana.address, r.potId)
        const linked = await link(r.slug, r.potId, ana.address, r.ana.token)
        expect(linked.status).toBe(200)
        const pot = (linked.body as RoomState).pots![0]
        expect(pot.walletPotId).toBe(id)
        expect(pot.walletToken).toBe('USDC')
    })

    it('answers a retryable 409 while the creating transaction is not mined', async () => {
        const r = await setup()
        const pending = await link(r.slug, r.potId, ana.address, r.ana.token)
        expect(pending.status).toBe(409)
        expect((pending.body as ApiError).error.code).toBe('VAQUITA_WALLET_PENDING')
    })

    it('refuses a wallet created by someone who is not in the tribu', async () => {
        const r = await setup()
        putOnChain(stranger.address, r.potId, { members: [stranger.address] })
        const refused = await link(r.slug, r.potId, stranger.address)
        expect(refused.status).toBe(400)
        expect((refused.body as ApiError).error.code).toBe('VAQUITA_NOT_MEMBER')
    })

    it('refuses a wallet holding a token Tribu does not settle in', async () => {
        const r = await setup()
        putOnChain(ana.address, r.potId, { token: '0x8888888888888888888888888888888888888888' })
        const refused = await link(r.slug, r.potId, ana.address, r.ana.token)
        expect(refused.status).toBe(409)
    })

    it('keeps the first wallet: a second one cannot replace it', async () => {
        const r = await setup()
        putOnChain(ana.address, r.potId)
        await link(r.slug, r.potId, ana.address, r.ana.token)
        putOnChain(bea.address, r.potId)
        const second = await link(r.slug, r.potId, bea.address, r.bea.token)
        expect(second.status).toBe(400)
        expect((second.body as ApiError).error.code).toBe('VAQUITA_WALLET_EXISTS')
    })
})

describe('reading a vaquita wallet', () => {
    it('shows each part, by tribu member, and proposals with their notes, newest first', async () => {
        const r = await setup()
        const memo = `0x${'ab'.repeat(32)}`
        putOnChain(ana.address, r.potId, {
            parts: { [lower(ana.address)]: 30_000_000n, [lower(bea.address)]: 10_000_000n },
            proposals: [
                {
                    action: 0,
                    target: bea.address,
                    amount: 5_000_000n,
                    memo: `0x${'00'.repeat(32)}`,
                    proposer: ana.address,
                    executed: true,
                    cancelled: false,
                    approvedBy: [lower(ana.address), lower(bea.address)],
                },
                {
                    action: 0,
                    target: ana.address,
                    amount: 12_000_000n,
                    memo,
                    proposer: bea.address,
                    executed: false,
                    cancelled: false,
                    approvedBy: [lower(bea.address)],
                },
            ],
        })
        await link(r.slug, r.potId, ana.address, r.ana.token)
        const noted = await call(postNote as Handler, {
            path: `/api/rooms/${r.slug}/pots/${r.potId}/wallet/notes`,
            method: 'POST',
            params: { slug: r.slug, potId: r.potId },
            body: { memo, text: 'Expensas' },
        })
        expect(noted.status).toBe(201)

        const { status, body } = await read(r.slug, r.potId)
        expect(status).toBe(200)
        const wallet = body as ApiPotWallet
        expect(wallet.totalUnits).toBe('40000000')
        expect(wallet.approvalsNeeded).toBe(2)
        expect(wallet.members).toEqual([
            { wallet: lower(ana.address), memberId: r.ana.id, partUnits: '30000000' },
            { wallet: lower(bea.address), memberId: r.bea.id, partUnits: '10000000' },
        ])
        expect(wallet.proposals.map((p) => [p.id, p.status, p.note, p.targetMemberId])).toEqual([
            [1, 'open', 'Expensas', r.ana.id],
            [0, 'executed', null, r.bea.id],
        ])
        expect(wallet.proposals[0].approvedBy).toEqual([lower(bea.address)])
    })

    it("shows Aave's current rate for a pot that earns", async () => {
        const r = await setup()
        putOnChain(ana.address, r.potId, { earns: true })
        await link(r.slug, r.potId, ana.address, r.ana.token)
        const wallet = (await read(r.slug, r.potId)).body as ApiPotWallet
        expect(wallet.earns).toBe(true)
        expect(wallet.aprBps).toBe(425)
    })

    it('shows no rate for a pot that does not earn', async () => {
        const r = await setup()
        putOnChain(ana.address, r.potId)
        await link(r.slug, r.potId, ana.address, r.ana.token)
        const wallet = (await read(r.slug, r.potId)).body as ApiPotWallet
        expect(wallet.earns).toBe(false)
        expect(wallet.aprBps).toBeNull()
    })

    it('says so when the pot has no wallet', async () => {
        const r = await setup()
        const { status, body } = await read(r.slug, r.potId)
        expect(status).toBe(404)
        expect((body as ApiError).error.code).toBe('VAQUITA_NO_WALLET')
    })
})

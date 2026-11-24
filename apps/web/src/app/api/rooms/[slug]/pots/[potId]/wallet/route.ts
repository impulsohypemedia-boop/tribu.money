/**
 * A vaquita's real wallet. GET reads it from the chain; POST points the pot at the wallet a member
 * just created in the TribuVaquita contract.
 */
import type { ApiPotWallet } from '@/lib/api-types'
import { vaquitaContract, vaquitaWalletId } from '@/lib/lemon/vaquita'
import { badRequest, conflict, notFound, readJson, respond } from '@/server/http'
import { readVaquitaWallet } from '@/server/lemon/vaquita'
import { prisma } from '@/server/db'
import { linkPotWallet, potWrite } from '@/server/pots'
import { VAQUITA_READ_LIMIT, WRITE_LIMIT, enforceRateLimit } from '@/server/rateLimit'
import { loadRoom } from '@/server/roomState'
import { potWalletLinkSchema } from '@/server/validation'

export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ slug: string; potId: string }> }

function contractOrThrow() {
    const contract = vaquitaContract()
    if (!contract) throw notFound('vaquita wallets are not available yet', 'VAQUITA_UNAVAILABLE')
    return contract
}

export const GET = (request: Request, ctx: Ctx) =>
    respond(async (): Promise<ApiPotWallet> => {
        enforceRateLimit(request, VAQUITA_READ_LIMIT, 'vaquita-wallet')
        const contract = contractOrThrow()
        const { slug, potId } = await ctx.params
        const room = await loadRoom(slug)
        const pot = room.pots.find((candidate) => candidate.id === potId)
        if (!pot) throw notFound('pot not found', 'POT_NOT_FOUND')
        if (!pot.walletPotId) throw notFound('this pot has no wallet', 'VAQUITA_NO_WALLET')
        const wallet = await readVaquitaWallet(contract, pot.walletPotId as `0x${string}`)
        if (!wallet) throw notFound('the wallet is not on the chain', 'VAQUITA_NO_WALLET')

        const memberOf = (address: string) =>
            room.members.find((member) => member.walletAddress === address.toLowerCase())?.id ?? null
        const notes = await prisma.potWalletNote.findMany({
            where: { potId: pot.id, memo: { in: wallet.proposals.map((proposal) => proposal.memo) } },
        })
        return {
            walletPotId: pot.walletPotId,
            token: wallet.token.symbol,
            decimals: wallet.token.decimals,
            earns: wallet.earns,
            aprBps: wallet.aprBps,
            approvalsNeeded: wallet.approvalsNeeded,
            totalUnits: wallet.totalUnits.toString(),
            members: wallet.members.map((member) => ({
                wallet: member.wallet,
                memberId: memberOf(member.wallet),
                partUnits: member.partUnits.toString(),
            })),
            proposals: wallet.proposals.map((proposal) => ({
                id: proposal.id,
                action: proposal.action,
                target: proposal.target,
                targetMemberId: memberOf(proposal.target),
                amountUnits: proposal.amountUnits.toString(),
                note: notes.find((note) => note.memo === proposal.memo)?.text ?? null,
                memo: proposal.memo,
                proposer: proposal.proposer,
                status: proposal.status,
                approvedBy: proposal.approvedBy,
            })),
        }
    })

export const POST = (request: Request, ctx: Ctx) =>
    respond(async () => {
        enforceRateLimit(request, WRITE_LIMIT, 'vaquita-wallet')
        const contract = contractOrThrow()
        const { slug, potId } = await ctx.params
        const { creator } = potWalletLinkSchema.parse(await readJson(request))
        const room = await loadRoom(slug)
        if (!room.pots.some((pot) => pot.id === potId)) throw notFound('pot not found', 'POT_NOT_FOUND')

        // Read the chain before taking the room lock: an RPC call must not hold a transaction open.
        const walletPotId = vaquitaWalletId(creator.toLowerCase() as `0x${string}`, potId)
        const wallet = await readVaquitaWallet(contract, walletPotId)
        if (!wallet) throw conflict('the wallet is not on the chain yet', 'VAQUITA_WALLET_PENDING')
        if (!wallet.members.some((member) => member.wallet === creator.toLowerCase())) {
            throw badRequest('the creator is not in the wallet', 'VAQUITA_NOT_MEMBER')
        }
        return potWrite(request, slug, (tx, lockedRoom, actor) =>
            linkPotWallet(tx, request, lockedRoom, actor, potId, { creator, token: wallet.token.symbol })
        )
    })

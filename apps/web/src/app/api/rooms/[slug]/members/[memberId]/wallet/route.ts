/**
 * Link the Lemon wallet a member is paid at.
 *
 * Unlike an avatar, this is not table banter: whoever sets Ana's wallet decides where Ana's money
 * goes. So it takes both halves of proof: the caller holds Ana's member token (they are Ana on this
 * device), and the wallet signed a sign-in message Tribu issued (they control that wallet).
 */
import { prisma } from '@/server/db'
import { publish } from '@/server/events'
import { ApiError, memberTokenOf, notFound, readJson, respond } from '@/server/http'
import { lockRoomWrite } from '@/server/history'
import { isFormerMember } from '@/lib/members'
import { verifyWalletProof } from '@/server/lemon/identity'
import { chainClient } from '@/server/lemon/rpc'
import { WRITE_LIMIT, enforceRateLimit } from '@/server/rateLimit'
import { loadRoom, toRoomState } from '@/server/roomState'
import { walletLinkSchema } from '@/server/validation'

export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ slug: string; memberId: string }> }

export const POST = (request: Request, ctx: Ctx) =>
    respond(async () => {
        enforceRateLimit(request, WRITE_LIMIT, 'write')
        const { slug, memberId } = await ctx.params
        const body = walletLinkSchema.parse(await readJson(request))

        const room = await loadRoom(slug)
        const member = room.members.find((candidate) => candidate.id === memberId)
        if (!member || isFormerMember(member)) throw notFound('member not found')
        if (!member.token || memberTokenOf(request) !== member.token) {
            throw new ApiError(403, 'NOT_THIS_MEMBER', 'only this member can link their own wallet')
        }

        const client = chainClient()
        const wallet = await verifyWalletProof(body, (input) => client.verifyMessage(input))

        await prisma.$transaction(async (tx) => {
            await lockRoomWrite(tx, room.id)
            await tx.member.update({
                where: { id: member.id },
                data: { walletAddress: wallet, lemonTag: body.lemonTag || null, walletLinkedAt: new Date() },
            })
        })
        publish(room.id)
        return toRoomState(await loadRoom(slug))
    })

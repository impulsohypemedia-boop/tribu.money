/**
 * A member's profile: whether they are an honored guest, and where they ask to be paid (wallet,
 * bank alias or CBU/CVU, Lemon tag).
 *
 * The two halves trust different people. Marking someone an honored guest is a room decision,
 * like casting their avatar, so anyone holding the link may do it. Payout details decide where
 * the member's money is sent, so only the holder of that member's token may change them.
 */
import { prisma } from '@/server/db'
import { publish } from '@/server/events'
import { ApiError, badRequest, memberTokenOf, notFound, readJson, respond } from '@/server/http'
import { actorFromToken, appendRoomAuditEvent, lockRoomWrite } from '@/server/history'
import { isFormerMember } from '@/lib/members'
import { normalizeBankAccount, normalizeLemonTag, normalizePayoutAddress, type PayoutNetwork } from '@/lib/payout'
import { WRITE_LIMIT, enforceRateLimit } from '@/server/rateLimit'
import { loadRoom, toRoomState } from '@/server/roomState'
import { memberProfileSchema } from '@/server/validation'

export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ slug: string; memberId: string }> }

export const PATCH = (request: Request, ctx: Ctx) =>
    respond(async () => {
        enforceRateLimit(request, WRITE_LIMIT, 'write')
        const { slug, memberId } = await ctx.params
        const body = memberProfileSchema.parse(await readJson(request))

        const room = await loadRoom(slug)
        const member = room.members.find((candidate) => candidate.id === memberId)
        if (!member || isFormerMember(member)) throw notFound('member not found')

        const ownFieldsChanged = body.payout !== undefined || body.bank !== undefined || body.lemonTag !== undefined
        if (ownFieldsChanged && (!member.token || memberTokenOf(request) !== member.token)) {
            throw new ApiError(403, 'NOT_THIS_MEMBER', 'only this member can set where they get paid')
        }

        let payout: { payoutToken: string | null; payoutNetwork: string | null; payoutAddress: string | null } | null =
            null
        if (body.payout === null) {
            payout = { payoutToken: null, payoutNetwork: null, payoutAddress: null }
        } else if (body.payout) {
            const network = body.payout.network as PayoutNetwork
            const address = normalizePayoutAddress(network, body.payout.address)
            if (!address) throw badRequest('that address does not fit the network', 'PAYOUT_ADDRESS_INVALID')
            payout = { payoutToken: body.payout.token, payoutNetwork: network, payoutAddress: address }
        }

        // An empty string or null clears the field; anything else must be valid.
        let payoutBank: string | null | undefined
        if (body.bank !== undefined) {
            const typed = body.bank?.trim() ?? ''
            payoutBank = typed ? normalizeBankAccount(typed) : null
            if (typed && !payoutBank) throw badRequest('that is not a bank alias or a CBU/CVU', 'PAYOUT_BANK_INVALID')
        }

        let payoutLemonTag: string | null | undefined
        if (body.lemonTag !== undefined) {
            const typed = body.lemonTag?.trim() ?? ''
            payoutLemonTag = typed ? normalizeLemonTag(typed) : null
            if (typed && !payoutLemonTag) throw badRequest('that is not a Lemon tag', 'PAYOUT_LEMON_TAG_INVALID')
        }

        const result = await prisma.$transaction(async (tx) => {
            await lockRoomWrite(tx, room.id)
            const locked = await loadRoom(slug, tx)
            const target = locked.members.find((candidate) => candidate.id === memberId)
            if (!target || isFormerMember(target)) throw notFound('member not found')

            const before = {
                honoredGuest: target.honoredGuest,
                payoutToken: target.payoutToken,
                payoutNetwork: target.payoutNetwork,
                payoutAddress: target.payoutAddress,
                payoutBank: target.payoutBank,
                payoutLemonTag: target.payoutLemonTag,
            }
            const after = {
                honoredGuest: body.honoredGuest ?? target.honoredGuest,
                ...(payout ?? {
                    payoutToken: target.payoutToken,
                    payoutNetwork: target.payoutNetwork,
                    payoutAddress: target.payoutAddress,
                }),
                payoutBank: payoutBank === undefined ? target.payoutBank : payoutBank,
                payoutLemonTag: payoutLemonTag === undefined ? target.payoutLemonTag : payoutLemonTag,
            }
            const changed = (Object.keys(after) as (keyof typeof after)[]).some((key) => after[key] !== before[key])
            if (changed) {
                await tx.member.update({ where: { id: memberId }, data: after })
                await appendRoomAuditEvent({
                    tx,
                    request,
                    roomId: room.id,
                    actor: actorFromToken(locked.members, memberTokenOf(request)),
                    event: {
                        kind: 'member_profile_updated',
                        subjectType: 'member',
                        subjectId: target.id,
                        before: { name: target.name, ...before },
                        after: { name: target.name, ...after },
                    },
                })
            }
            return { changed, state: toRoomState(await loadRoom(slug, tx)) }
        })
        if (result.changed) publish(room.id)
        return result.state
    })

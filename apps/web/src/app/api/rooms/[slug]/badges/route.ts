/** A signed voucher to keep an earned badge as an NFT in the member's linked Lemon wallet. */
import { z } from 'zod'
import { BADGES } from '@/lib/badges'
import { badgeVoucher } from '@/server/badges/voucher'
import { memberTokenOf, readJson, respond } from '@/server/http'
import { WRITE_LIMIT, enforceRateLimit } from '@/server/rateLimit'
import { loadRoom, memberIdForToken } from '@/server/roomState'

export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ slug: string }> }

const bodySchema = z.object({ badge: z.enum(BADGES.map((badge) => badge.id) as [string, ...string[]]) })

export const POST = (request: Request, ctx: Ctx) =>
    respond(async () => {
        enforceRateLimit(request, WRITE_LIMIT, 'write')
        const { slug } = await ctx.params
        const { badge } = bodySchema.parse(await readJson(request))
        const room = await loadRoom(slug)
        return badgeVoucher(
            room,
            memberIdForToken(room, memberTokenOf(request)),
            badge as (typeof BADGES)[number]['id']
        )
    })

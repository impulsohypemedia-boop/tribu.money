/** Take back a contribution recorded by mistake, with the payment to the keeper it created. */
import { respond } from '@/server/http'
import { potWrite, removeContribution } from '@/server/pots'

export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ slug: string; potId: string; contributionId: string }> }

export const DELETE = (request: Request, ctx: Ctx) =>
    respond(async () => {
        const { slug, potId, contributionId } = await ctx.params
        return potWrite(request, slug, (tx, room, actor) =>
            removeContribution(tx, request, room, actor, potId, contributionId)
        )
    })

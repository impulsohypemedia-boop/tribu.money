/** Put money in the vaquita. Recorded as a payment to the keeper, who holds the pot. */
import { readJson, respond } from '@/server/http'
import { addContribution, potWrite } from '@/server/pots'
import { potContributionSchema } from '@/server/validation'

export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ slug: string; potId: string }> }

export const POST = (request: Request, ctx: Ctx) =>
    respond(async () => {
        const { slug, potId } = await ctx.params
        const body = potContributionSchema.parse(await readJson(request))
        return potWrite(request, slug, (tx, room, actor) => addContribution(tx, request, room, actor, potId, body))
    }, 201)

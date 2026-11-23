/** Accept, settle or drop a bet. Only the two people in it may. */
import { readJson, respond } from '@/server/http'
import { potWrite } from '@/server/pots'
import { actOnBet } from '@/server/tribeGames'
import { betActionSchema } from '@/server/validation'

export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ slug: string; betId: string }> }

export const POST = (request: Request, ctx: Ctx) =>
    respond(async () => {
        const { slug, betId } = await ctx.params
        const body = betActionSchema.parse(await readJson(request))
        return potWrite(request, slug, (tx, room, actor) => actOnBet(tx, request, room, actor, betId, body))
    })

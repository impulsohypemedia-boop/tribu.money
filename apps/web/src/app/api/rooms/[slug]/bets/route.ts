/** Propose a bet to someone in the tribu. */
import { readJson, respond } from '@/server/http'
import { potWrite } from '@/server/pots'
import { createBet } from '@/server/tribeGames'
import { betCreateSchema } from '@/server/validation'

export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ slug: string }> }

export const POST = (request: Request, ctx: Ctx) =>
    respond(async () => {
        const { slug } = await ctx.params
        const body = betCreateSchema.parse(await readJson(request))
        return potWrite(request, slug, (tx, room, actor) => createBet(tx, request, room, actor, body))
    }, 201)

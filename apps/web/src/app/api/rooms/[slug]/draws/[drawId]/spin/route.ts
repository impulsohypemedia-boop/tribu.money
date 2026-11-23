/** Spin a ruleta: pick who covers the bill and record it as an expense, with the proof. */
import { readJson, respond } from '@/server/http'
import { potWrite } from '@/server/pots'
import { spinDraw } from '@/server/tribeGames'
import { drawSpinSchema } from '@/server/validation'

export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ slug: string; drawId: string }> }

export const POST = (request: Request, ctx: Ctx) =>
    respond(async () => {
        const { slug, drawId } = await ctx.params
        const body = drawSpinSchema.parse(await readJson(request))
        return potWrite(request, slug, (tx, room, actor) => spinDraw(tx, request, room, actor, drawId, body))
    }, 201)

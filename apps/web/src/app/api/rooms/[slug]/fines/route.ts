/** Propose a fine. The tribu votes on it before anyone pays. */
import { readJson, respond } from '@/server/http'
import { potWrite } from '@/server/pots'
import { proposeFine } from '@/server/tribeGames'
import { fineCreateSchema } from '@/server/validation'

export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ slug: string }> }

export const POST = (request: Request, ctx: Ctx) =>
    respond(async () => {
        const { slug } = await ctx.params
        const body = fineCreateSchema.parse(await readJson(request))
        return potWrite(request, slug, (tx, room, actor) => proposeFine(tx, request, room, actor, body))
    }, 201)

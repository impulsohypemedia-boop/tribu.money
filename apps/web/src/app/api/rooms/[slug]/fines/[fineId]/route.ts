/** Vote on a fine, pay an approved one into the pot, or drop it. */
import { readJson, respond } from '@/server/http'
import { potWrite } from '@/server/pots'
import { actOnFine } from '@/server/tribeGames'
import { fineActionSchema } from '@/server/validation'

export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ slug: string; fineId: string }> }

export const POST = (request: Request, ctx: Ctx) =>
    respond(async () => {
        const { slug, fineId } = await ctx.params
        const body = fineActionSchema.parse(await readJson(request))
        return potWrite(request, slug, (tx, room, actor) => actOnFine(tx, request, room, actor, fineId, body))
    })

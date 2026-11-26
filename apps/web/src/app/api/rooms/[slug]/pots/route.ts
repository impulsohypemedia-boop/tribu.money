/** Start a vaquita. Anyone in the room may, as with adding an expense: the link is the credential. */
import { readJson, respond } from '@/server/http'
import { createPot, potWrite } from '@/server/pots'
import { potCreateSchema } from '@/server/validation'

export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ slug: string }> }

export const POST = (request: Request, ctx: Ctx) =>
    respond(async () => {
        const { slug } = await ctx.params
        const body = potCreateSchema.parse(await readJson(request))
        return potWrite(request, slug, (tx, room, actor) => createPot(tx, request, room, actor, body))
    }, 201)

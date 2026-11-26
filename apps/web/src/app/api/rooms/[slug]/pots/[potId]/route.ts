/** Edit a vaquita's goal, or close it. Closing moves no money: what is left is already credit. */
import { readJson, respond } from '@/server/http'
import { potWrite, updatePot } from '@/server/pots'
import { potUpdateSchema } from '@/server/validation'

export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ slug: string; potId: string }> }

export const PATCH = (request: Request, ctx: Ctx) =>
    respond(async () => {
        const { slug, potId } = await ctx.params
        const body = potUpdateSchema.parse(await readJson(request))
        return potWrite(request, slug, (tx, room, actor) => updatePot(tx, request, room, actor, potId, body))
    })

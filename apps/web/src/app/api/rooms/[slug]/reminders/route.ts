/** Send a friendly reminder to someone in the tribu who still has to pay you. */
import { readJson, respond } from '@/server/http'
import { sendReminder } from '@/server/reminders'
import { reminderSchema } from '@/server/validation'

export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ slug: string }> }

export const POST = (request: Request, ctx: Ctx) =>
    respond(async () => {
        const { slug } = await ctx.params
        const body = reminderSchema.parse(await readJson(request))
        return sendReminder(request, slug, body.toId)
    }, 201)

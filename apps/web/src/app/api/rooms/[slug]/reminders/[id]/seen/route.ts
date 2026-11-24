/** The person reminded puts the notice away. */
import { respond } from '@/server/http'
import { dismissReminder } from '@/server/reminders'

export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ slug: string; id: string }> }

export const POST = (request: Request, ctx: Ctx) =>
    respond(async () => {
        const { slug, id } = await ctx.params
        return dismissReminder(request, slug, id)
    })

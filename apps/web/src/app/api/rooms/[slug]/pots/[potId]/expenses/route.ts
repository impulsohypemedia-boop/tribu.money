/** Mark a saved expense as paid by the vaquita. */
import { readJson, respond } from '@/server/http'
import { potWrite, setExpensePot } from '@/server/pots'
import { potSpendSchema } from '@/server/validation'

export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ slug: string; potId: string }> }

export const POST = (request: Request, ctx: Ctx) =>
    respond(async () => {
        const { slug, potId } = await ctx.params
        const body = potSpendSchema.parse(await readJson(request))
        return potWrite(request, slug, (tx, room, actor) =>
            setExpensePot(tx, request, room, actor, potId, body.expenseId)
        )
    })

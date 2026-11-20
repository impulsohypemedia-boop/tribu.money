/** Take the vaquita mark off an expense. The expense stays, paid by the keeper. */
import { respond } from '@/server/http'
import { potWrite, setExpensePot } from '@/server/pots'

export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ slug: string; potId: string; expenseId: string }> }

export const DELETE = (request: Request, ctx: Ctx) =>
    respond(async () => {
        const { slug, expenseId } = await ctx.params
        return potWrite(request, slug, (tx, room, actor) => setExpensePot(tx, request, room, actor, null, expenseId))
    })

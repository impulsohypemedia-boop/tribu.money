/**
 * Presupuesto del grupo: save the tribu's monthly limits. The body is the whole list, so a limit
 * left out is removed. The link is the credential, as for adding an expense: anyone in the tribu
 * can set the plan.
 */
import { readJson, respond } from '@/server/http'
import { saveBudgets } from '@/server/budgets'
import { budgetsSchema } from '@/server/validation'

export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ slug: string }> }

export const POST = (request: Request, ctx: Ctx) =>
    respond(async () => {
        const { slug } = await ctx.params
        const body = budgetsSchema.parse(await readJson(request))
        return saveBudgets(request, slug, body.budgets)
    })

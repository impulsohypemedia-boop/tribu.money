/**
 * Tribu de pareja: save the couple's default split. The link is the credential, as for adding an
 * expense: either of the two can change it, and it only fills the form for new expenses.
 */
import { readJson, respond } from '@/server/http'
import { saveCoupleSplit } from '@/server/couple'
import { coupleSplitSchema } from '@/server/validation'

export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ slug: string }> }

export const POST = (request: Request, ctx: Ctx) =>
    respond(async () => {
        const { slug } = await ctx.params
        const body = coupleSplitSchema.parse(await readJson(request))
        return saveCoupleSplit(request, slug, body.split)
    })

import { respond } from '@/server/http'
import { roomLedgerBySlug } from '@/server/ledger'
import { meterRoomLookup } from '@/server/rateLimit'

export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ slug: string }> }

export const GET = async (request: Request, ctx: Ctx) => {
    const response = await respond(async () => {
        const { slug } = await ctx.params
        const cursor = new URL(request.url).searchParams.get('cursor')
        return meterRoomLookup(request, () => roomLedgerBySlug(slug, cursor))
    })
    response.headers.set('Cache-Control', 'private, no-store')
    return response
}

/** Start a ruleta: the server fixes its secret seed and shows only its hash until the spin. */
import { prisma } from '@/server/db'
import { respond } from '@/server/http'
import { WRITE_LIMIT, enforceRateLimit } from '@/server/rateLimit'
import { loadRoom } from '@/server/roomState'
import { startDraw } from '@/server/tribeGames'

export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ slug: string }> }

export const POST = (request: Request, ctx: Ctx) =>
    respond(async () => {
        enforceRateLimit(request, WRITE_LIMIT, 'write')
        const { slug } = await ctx.params
        const room = await loadRoom(slug)
        return startDraw(prisma, room)
    }, 201)

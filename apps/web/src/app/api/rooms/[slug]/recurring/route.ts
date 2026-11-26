/**
 * Start repeating a saved expense every month. The link is the credential, as for adding the
 * expense itself: anyone in the room may set up a shared monthly cost.
 */
import { prisma } from '@/server/db'
import { publish } from '@/server/events'
import { readJson, respond } from '@/server/http'
import { lockRoomWrite } from '@/server/history'
import { WRITE_LIMIT, enforceRateLimit } from '@/server/rateLimit'
import { startRecurring } from '@/server/recurring'
import { loadRoom, toRoomState } from '@/server/roomState'
import { recurringStartSchema } from '@/server/validation'

export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ slug: string }> }

export const POST = (request: Request, ctx: Ctx) =>
    respond(async () => {
        enforceRateLimit(request, WRITE_LIMIT, 'write')
        const { slug } = await ctx.params
        const body = recurringStartSchema.parse(await readJson(request))
        const room = await loadRoom(slug)
        const state = await prisma.$transaction(async (tx) => {
            await lockRoomWrite(tx, room.id)
            await startRecurring(tx, await loadRoom(slug, tx), body.expenseId)
            return toRoomState(await loadRoom(slug, tx))
        })
        publish(room.id)
        return state
    }, 201)

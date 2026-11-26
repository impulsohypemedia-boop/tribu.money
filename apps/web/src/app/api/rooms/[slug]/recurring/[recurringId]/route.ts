/** Stop a monthly expense. Months already created stay; nothing new is added after this. */
import { prisma } from '@/server/db'
import { publish } from '@/server/events'
import { notFound, respond } from '@/server/http'
import { lockRoomWrite } from '@/server/history'
import { WRITE_LIMIT, enforceRateLimit } from '@/server/rateLimit'
import { loadRoom, toRoomState } from '@/server/roomState'

export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ slug: string; recurringId: string }> }

export const DELETE = (request: Request, ctx: Ctx) =>
    respond(async () => {
        enforceRateLimit(request, WRITE_LIMIT, 'write')
        const { slug, recurringId } = await ctx.params
        const room = await loadRoom(slug)
        const state = await prisma.$transaction(async (tx) => {
            await lockRoomWrite(tx, room.id)
            const stopped = await tx.recurringExpense.updateMany({
                where: { id: recurringId, roomId: room.id, stoppedAt: null },
                data: { stoppedAt: new Date() },
            })
            if (stopped.count === 0) {
                const exists = await tx.recurringExpense.findFirst({ where: { id: recurringId, roomId: room.id } })
                if (!exists) throw notFound('monthly expense not found')
            }
            return toRoomState(await loadRoom(slug, tx))
        })
        publish(room.id)
        return state
    })

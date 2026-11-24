/** Presupuesto del grupo: replace a tribu's monthly limits in one write. */
import { prisma } from '@/server/db'
import { publish } from '@/server/events'
import { badRequest } from '@/server/http'
import { lockRoomWrite } from '@/server/history'
import { WRITE_LIMIT, enforceRateLimit } from '@/server/rateLimit'
import { loadRoom, toRoomState } from '@/server/roomState'
import type { RoomState } from '@/lib/api-types'

export async function saveBudgets(
    request: Request,
    slug: string,
    budgets: readonly { category: string; amountMinor: string }[]
): Promise<RoomState> {
    enforceRateLimit(request, WRITE_LIMIT, 'write')
    const room = await loadRoom(slug)
    // A vaquita is one shared pot with its own goal; a monthly spending plan belongs to a tribu.
    if (room.kind !== 'tribu') throw badRequest('only a tribu has a monthly budget', 'BUDGET_NOT_FOR_VAQUITA')
    const state = await prisma.$transaction(async (tx) => {
        await lockRoomWrite(tx, room.id)
        await tx.budget.deleteMany({ where: { roomId: room.id } })
        if (budgets.length > 0) {
            await tx.budget.createMany({
                data: budgets.map((budget) => ({
                    roomId: room.id,
                    category: budget.category,
                    amountMinor: BigInt(budget.amountMinor),
                })),
            })
        }
        return toRoomState(await loadRoom(slug, tx))
    })
    publish(room.id)
    return state
}

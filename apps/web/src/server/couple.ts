/** Tribu de pareja: save how the couple splits new expenses by default. */
import { Prisma } from '@prisma/client'
import { prisma } from '@/server/db'
import { publish } from '@/server/events'
import { badRequest } from '@/server/http'
import { lockRoomWrite } from '@/server/history'
import { WRITE_LIMIT, enforceRateLimit } from '@/server/rateLimit'
import { loadRoom, toRoomState } from '@/server/roomState'
import type { RoomState } from '@/lib/api-types'

export async function saveCoupleSplit(
    request: Request,
    slug: string,
    split: Record<string, number> | null
): Promise<RoomState> {
    enforceRateLimit(request, WRITE_LIMIT, 'write')
    const initial = await loadRoom(slug)
    if (initial.kind !== 'pareja') throw badRequest('only a couple tribu has a default split', 'NOT_A_COUPLE')
    const state = await prisma.$transaction(async (tx) => {
        await lockRoomWrite(tx, initial.id)
        const room = await loadRoom(slug, tx)
        if (split) {
            const active = new Set(room.members.filter((member) => !member.removedAt).map((member) => member.id))
            if (!Object.keys(split).every((memberId) => active.has(memberId)))
                throw badRequest('the split names someone who is not in the tribu', 'COUPLE_SPLIT_MEMBER')
        }
        await tx.room.update({
            where: { id: room.id },
            data: { coupleSplit: split ?? Prisma.DbNull },
        })
        return toRoomState(await loadRoom(slug, tx))
    })
    publish(initial.id)
    return state
}

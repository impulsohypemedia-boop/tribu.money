/**
 * Recordatorio amable: someone who is owed money nudges the person who owes it,
 * and that person sees a notice the next time they open the tribu.
 *
 * The rules live in `lib/reminders.ts` so the button and the server agree; here
 * they are checked again under the room lock, so two phones tapping at once
 * still send one reminder.
 */
import { prisma } from '@/server/db'
import { publish } from '@/server/events'
import { ApiError, conflict, memberTokenOf, notFound } from '@/server/http'
import { actorFromToken, lockRoomWrite } from '@/server/history'
import { notifyReminder } from '@/server/push'
import { WRITE_LIMIT, enforceRateLimit } from '@/server/rateLimit'
import { loadRoom, toRoomState } from '@/server/roomState'
import { checkReminder } from '@/lib/reminders'
import type { RoomState } from '@/lib/api-types'

const needsMember = () =>
    new ApiError(403, 'MEMBER_TOKEN_INVALID', 'this device is not signed in as a member of this room')

export async function sendReminder(request: Request, slug: string, toId: string): Promise<RoomState> {
    enforceRateLimit(request, WRITE_LIMIT, 'write')
    const initial = await loadRoom(slug)
    const token = memberTokenOf(request)
    const result = await prisma.$transaction(async (tx) => {
        await lockRoomWrite(tx, initial.id)
        const room = await loadRoom(slug, tx)
        const fromId = actorFromToken(room.members, token).memberId
        if (!fromId) throw needsMember()
        const check = checkReminder(toRoomState(room), fromId, toId)
        if (!check.ok) {
            if (check.reason === 'too-soon') {
                throw new ApiError(429, 'REMINDER_TOO_SOON', 'this person was reminded recently', {
                    nextAt: check.nextAt.toISOString(),
                })
            }
            throw conflict('there is nothing pending to remind about', 'REMINDER_NOTHING_PENDING')
        }
        const reminder = await tx.reminder.create({ data: { roomId: room.id, fromId, toId } })
        const fresh = await loadRoom(slug, tx)
        return { reminder, fresh, amountMinor: check.transfer.amountMinor }
    })
    publish(initial.id)
    notifyReminder({
        room: result.fresh,
        reminderId: result.reminder.id,
        fromId: result.reminder.fromId,
        toId: result.reminder.toId,
        amountMinor: result.amountMinor,
    })
    return toRoomState(result.fresh)
}

/** Only the person reminded can put the notice away. */
export async function dismissReminder(request: Request, slug: string, reminderId: string): Promise<RoomState> {
    enforceRateLimit(request, WRITE_LIMIT, 'write')
    const room = await loadRoom(slug)
    const meId = actorFromToken(room.members, memberTokenOf(request)).memberId
    if (!meId) throw needsMember()
    const reminder = await prisma.reminder.findFirst({ where: { id: reminderId, roomId: room.id } })
    if (!reminder) throw notFound('reminder not found')
    if (reminder.toId !== meId) throw needsMember()
    if (!reminder.seenAt) {
        // Every older reminder to the same person goes too: one tap clears the notice.
        await prisma.reminder.updateMany({
            where: { roomId: room.id, toId: meId, seenAt: null, createdAt: { lte: reminder.createdAt } },
            data: { seenAt: new Date() },
        })
        publish(room.id)
    }
    return toRoomState(await loadRoom(slug))
}

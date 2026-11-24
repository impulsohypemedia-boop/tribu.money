/**
 * Recordatorio amable: the rules for who may nudge whom, and when.
 *
 * Shared by the server (which enforces them under the room lock) and the screen
 * (which hides or explains the button), so both always agree.
 */
import type { ApiReminder, ApiTransfer, RoomState } from '@/lib/api-types'

/** One reminder per person per tribu every three days, whoever sends it. */
export const REMINDER_COOLDOWN_MS = 3 * 24 * 60 * 60 * 1000

/** What `toId` still has to pass to `fromId` in the room's plan, if anything. */
export function pendingTransfer(transfers: readonly ApiTransfer[], fromId: string, toId: string): ApiTransfer | null {
    return transfers.find((transfer) => transfer.fromId === toId && transfer.toId === fromId) ?? null
}

export type ReminderCheck =
    | { ok: true; transfer: ApiTransfer }
    | { ok: false; reason: 'self' | 'nothing-pending' }
    | { ok: false; reason: 'too-soon'; nextAt: Date }

/**
 * Whether `fromId` can remind `toId` now. Only someone who is owed money by
 * `toId` can, and `toId` hears about it at most once per cooldown in a tribu,
 * so three people owed money cannot pile on the same person on the same day.
 */
export function checkReminder(
    state: Pick<RoomState, 'suggestedTransfers' | 'reminders'>,
    fromId: string,
    toId: string,
    now: Date = new Date()
): ReminderCheck {
    if (fromId === toId) return { ok: false, reason: 'self' }
    const transfer = pendingTransfer(state.suggestedTransfers, fromId, toId)
    if (!transfer) return { ok: false, reason: 'nothing-pending' }
    const last = latestReminderTo(state.reminders ?? [], toId)
    if (last) {
        const nextAt = new Date(new Date(last.createdAt).getTime() + REMINDER_COOLDOWN_MS)
        if (nextAt > now) return { ok: false, reason: 'too-soon', nextAt }
    }
    return { ok: true, transfer }
}

function latestReminderTo(reminders: readonly ApiReminder[], toId: string): ApiReminder | null {
    let latest: ApiReminder | null = null
    for (const reminder of reminders) {
        if (reminder.toId !== toId) continue
        if (!latest || reminder.createdAt > latest.createdAt) latest = reminder
    }
    return latest
}

/**
 * The notice the reminded person sees: the newest reminder they have not
 * dismissed, from someone they still have to pay. Once they pay, it goes away
 * by itself.
 */
export function reminderNoticeFor(
    state: Pick<RoomState, 'suggestedTransfers' | 'reminders'>,
    meId: string | undefined
): { reminder: ApiReminder; transfer: ApiTransfer } | null {
    if (!meId) return null
    const unseen = (state.reminders ?? [])
        .filter((reminder) => reminder.toId === meId && reminder.seenAt === null)
        .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
    for (const reminder of unseen) {
        const transfer = pendingTransfer(state.suggestedTransfers, reminder.fromId, meId)
        if (transfer) return { reminder, transfer }
    }
    return null
}

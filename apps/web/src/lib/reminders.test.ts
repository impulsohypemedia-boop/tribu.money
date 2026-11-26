import { describe, expect, it } from 'vitest'
import type { ApiReminder } from '@/lib/api-types'
import { REMINDER_COOLDOWN_MS, checkReminder, reminderNoticeFor } from './reminders'

const now = new Date('2026-11-24T12:00:00Z')
const ago = (ms: number) => new Date(now.getTime() - ms).toISOString()
const reminder = (over: Partial<ApiReminder>): ApiReminder => ({
    id: 'r1',
    fromId: 'ana',
    toId: 'beto',
    createdAt: ago(60_000),
    seenAt: null,
    ...over,
})
// Beto passes Ana 1500; Caro passes Ana 500.
const suggestedTransfers = [
    { fromId: 'beto', toId: 'ana', amountMinor: '1500' },
    { fromId: 'caro', toId: 'ana', amountMinor: '500' },
]

describe('checkReminder', () => {
    it('lets the person who is owed remind the person who owes', () => {
        const result = checkReminder({ suggestedTransfers, reminders: [] }, 'ana', 'beto', now)
        expect(result).toEqual({ ok: true, transfer: suggestedTransfers[0] })
    })

    it('refuses when nothing is pending in that direction', () => {
        expect(checkReminder({ suggestedTransfers, reminders: [] }, 'beto', 'ana', now)).toEqual({
            ok: false,
            reason: 'nothing-pending',
        })
        expect(checkReminder({ suggestedTransfers, reminders: [] }, 'caro', 'beto', now).ok).toBe(false)
    })

    it('refuses reminding yourself', () => {
        expect(checkReminder({ suggestedTransfers, reminders: [] }, 'ana', 'ana', now)).toEqual({
            ok: false,
            reason: 'self',
        })
    })

    it('waits out the cooldown, whoever sent the last one', () => {
        const recent = reminder({ fromId: 'someone-else', createdAt: ago(REMINDER_COOLDOWN_MS - 1000) })
        const result = checkReminder({ suggestedTransfers, reminders: [recent] }, 'ana', 'beto', now)
        expect(result.ok).toBe(false)
        if (!result.ok && result.reason === 'too-soon') {
            expect(result.nextAt.toISOString()).toBe(new Date(now.getTime() + 1000).toISOString())
        } else {
            throw new Error('expected too-soon')
        }
    })

    it('allows again once the cooldown has passed', () => {
        const old = reminder({ createdAt: ago(REMINDER_COOLDOWN_MS) })
        expect(checkReminder({ suggestedTransfers, reminders: [old] }, 'ana', 'beto', now).ok).toBe(true)
    })

    it('does not let a reminder to one person block another', () => {
        const recent = reminder({ toId: 'caro' })
        expect(checkReminder({ suggestedTransfers, reminders: [recent] }, 'ana', 'beto', now).ok).toBe(true)
    })
})

describe('reminderNoticeFor', () => {
    it('shows the newest unseen reminder with what is still pending', () => {
        const older = reminder({ id: 'old', createdAt: ago(5 * 60_000) })
        const newer = reminder({ id: 'new', createdAt: ago(60_000) })
        const notice = reminderNoticeFor({ suggestedTransfers, reminders: [older, newer] }, 'beto')
        expect(notice?.reminder.id).toBe('new')
        expect(notice?.transfer.amountMinor).toBe('1500')
    })

    it('hides a dismissed reminder', () => {
        const seen = reminder({ seenAt: ago(1000) })
        expect(reminderNoticeFor({ suggestedTransfers, reminders: [seen] }, 'beto')).toBeNull()
    })

    it('goes away once the person has paid', () => {
        const paid = [{ fromId: 'caro', toId: 'ana', amountMinor: '500' }]
        expect(reminderNoticeFor({ suggestedTransfers: paid, reminders: [reminder({})] }, 'beto')).toBeNull()
    })

    it('is only for the person reminded', () => {
        expect(reminderNoticeFor({ suggestedTransfers, reminders: [reminder({})] }, 'ana')).toBeNull()
        expect(reminderNoticeFor({ suggestedTransfers, reminders: [reminder({})] }, undefined)).toBeNull()
    })
})

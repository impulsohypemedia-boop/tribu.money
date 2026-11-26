/**
 * Logros de la tribu: small shared milestones the whole group reaches together.
 *
 * Every milestone belongs to the group, never to one person, and none of them compares people or
 * reads who owes whom. They come from what the room already holds, so there is nothing to store
 * on the server; which ones this device has already celebrated lives in `achievement-storage.ts`.
 */
import type { RoomState } from './api-types'
import { defaultSplitMembers } from './members'
import { isRoomSettled, savedExpenses } from './pending'
import { potSummary } from './pots'

export const TRIBE_MILESTONE_IDS = [
    'first-expense',
    'expenses-10',
    'everyone-paid',
    'first-payment',
    'all-square',
    'three-currencies',
    'pot-goal',
    'expenses-50',
] as const
export type TribeMilestoneId = (typeof TRIBE_MILESTONE_IDS)[number]

export interface TribeMilestone {
    id: TribeMilestoneId
    reached: boolean
}

/** The seen-set id, kept apart from the shareable-card achievements that share the same store. */
export const milestoneSeenId = (id: TribeMilestoneId) => `logro-${id}`

export function tribeMilestones(state: RoomState): TribeMilestone[] {
    const expenses = savedExpenses(state.expenses)
    const people = defaultSplitMembers(state.members)
    const payers = new Set(expenses.map((expense) => expense.paidById))
    const currencies = new Set(expenses.map((expense) => expense.currency))
    const reached: Record<TribeMilestoneId, boolean> = {
        'first-expense': expenses.length >= 1,
        'expenses-10': expenses.length >= 10,
        'expenses-50': expenses.length >= 50,
        'everyone-paid': people.length >= 2 && people.every((member) => payers.has(member.id)),
        'first-payment': state.settlements.length >= 1,
        'all-square': isRoomSettled(state),
        'three-currencies': currencies.size >= 3,
        'pot-goal': (state.pots ?? []).some((pot) => potSummary(pot, state).missingMinor === '0'),
    }
    return TRIBE_MILESTONE_IDS.map((id) => ({ id, reached: reached[id] }))
}

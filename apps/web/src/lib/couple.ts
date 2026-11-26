/**
 * Tribu de pareja: the presets a couple's tribu adds on top of a normal tribu.
 *
 * Nothing here is money math. The default split only fills the expense form with the PERCENTAGE
 * split it already has, and the server computes the shares the usual way.
 */
import type { ApiMember, RoomState } from '@/lib/api-types'
import { activeMembers } from '@/lib/members'

/** The palette a new couple's tribu starts in (a key from `lib/themes.ts`). */
export const COUPLE_THEME = 'bubblegum'

export type RoomKind = 'tribu' | 'vaquita' | 'pareja'

export const isCoupleRoom = (state: Pick<RoomState, 'room'> | null | undefined): boolean =>
    state?.room.kind === 'pareja'

/**
 * Typical couple expenses, offered as one-tap starts in a pareja tribu. `monthly` ones open the
 * form already set to repeat every month. `category` is a subject id from the expense category
 * catalog, saved as the expense's category so the row gets the right drawing.
 */
export const COUPLE_EXPENSES = [
    { id: 'alquiler', category: 'rent-home', monthly: true },
    { id: 'super', category: 'groceries', monthly: false },
    { id: 'servicios', category: 'utilities', monthly: true },
    { id: 'salidas', category: 'drinks-nightlife', monthly: false },
    { id: 'delivery', category: 'pizza', monthly: false },
    { id: 'suscripciones', category: 'television', monthly: true },
    { id: 'mascota', category: 'pets', monthly: false },
    { id: 'regalos', category: 'gifts', monthly: false },
] as const

export type CoupleExpenseId = (typeof COUPLE_EXPENSES)[number]['id']

export const coupleExpense = (id: string | null | undefined) =>
    COUPLE_EXPENSES.find((preset) => preset.id === id) ?? null

/** The ready-made proportions offered next to "half and half", as the first person's percent. */
export const COUPLE_SPLIT_PRESETS = [50, 60, 70] as const

/** The two people of a couple: the first two active members, in the order they joined. */
export const coupleMembers = (members: readonly ApiMember[]): ApiMember[] => activeMembers(members).slice(0, 2)

/**
 * The stored split, if it still describes the couple as it is now: two whole percents, each
 * between 1 and 99, for exactly the two active members, adding up to 100. Anything else (a member
 * removed, a third person joined) falls back to half and half.
 */
export function coupleSplitFor(state: RoomState): Record<string, number> | null {
    const split = state.room.coupleSplit
    if (!isCoupleRoom(state) || !split) return null
    const active = activeMembers(state.members)
    if (active.length !== 2) return null
    const ids = active.map((member) => member.id)
    const values = ids.map((memberId) => split[memberId])
    if (Object.keys(split).length !== 2) return null
    if (!values.every((value) => Number.isInteger(value) && value >= 1 && value <= 99)) return null
    if (values.reduce((sum, value) => sum + value, 0) !== 100) return null
    return Object.fromEntries(ids.map((memberId, index) => [memberId, values[index]]))
}

/** A split is "half and half" when there is none or both parts are 50. */
export const isEvenSplit = (split: Record<string, number> | null): boolean =>
    !split || Object.values(split).every((value) => value === 50)

/**
 * The expense form's PERCENTAGE inputs for a couple's default split, or null to keep the form's
 * usual equal split. Even splits stay EQUAL so nothing changes for couples who split 50/50.
 */
export function coupleSplitPercentageInputs(state: RoomState): Record<string, string> | null {
    const split = coupleSplitFor(state)
    if (isEvenSplit(split)) return null
    return Object.fromEntries(Object.entries(split!).map(([memberId, pct]) => [memberId, String(pct)]))
}

/** Build the split to store from the first person's percent. 50 stores nothing. */
export function coupleSplitFromPercent(members: readonly ApiMember[], firstPct: number) {
    const [first, second] = coupleMembers(members)
    if (!first || !second || firstPct === 50) return null
    return { [first.id]: firstPct, [second.id]: 100 - firstPct }
}

/** The trip coming up soonest: an open pot with a date, in a couple's tribu. */
export function nextTrip(state: RoomState, now = new Date()) {
    if (!isCoupleRoom(state)) return null
    const upcoming = (state.pots ?? [])
        .filter((pot) => !pot.closedAt && pot.dueDate && new Date(pot.dueDate) >= startOfMonth(now))
        .sort((a, b) => a.dueDate!.localeCompare(b.dueDate!))
    const trip = upcoming[0]
    if (!trip) return null
    const due = new Date(trip.dueDate!)
    const monthsAway = (due.getUTCFullYear() - now.getFullYear()) * 12 + due.getUTCMonth() - now.getMonth()
    return { pot: trip, monthsAway: Math.max(0, monthsAway) }
}

const startOfMonth = (date: Date) => new Date(Date.UTC(date.getFullYear(), date.getMonth(), 1))

/** The default name for a couple's tribu: "Ana y Leo". */
export const coupleRoomName = (creator: string, partner: string, joiner: string) => {
    const a = creator.trim()
    const b = partner.trim()
    return a && b ? `${a} ${joiner} ${b}` : a || b
}

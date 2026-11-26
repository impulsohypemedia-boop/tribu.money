import { describe, expect, it } from 'vitest'
import type { ApiMember, RoomState } from './api-types'
import {
    COUPLE_EXPENSES,
    coupleExpense,
    coupleRoomName,
    coupleSplitFor,
    coupleSplitFromPercent,
    coupleSplitPercentageInputs,
} from './couple'
import { getExpenseSubject } from './expense-category'

const member = (id: string, name: string, removedAt: string | null = null) =>
    ({ id, name, removedAt, createdAt: '2026-11-01T00:00:00.000Z' }) as unknown as ApiMember

const room = (kind: 'tribu' | 'pareja', members: ApiMember[], coupleSplit: Record<string, number> | null) =>
    ({ room: { kind, coupleSplit }, members }) as unknown as RoomState

const ana = member('a', 'Ana')
const leo = member('b', 'Leo')

describe('coupleSplitFor', () => {
    it('reads a stored 60/40 split for the two people', () => {
        expect(coupleSplitFor(room('pareja', [ana, leo], { a: 60, b: 40 }))).toEqual({ a: 60, b: 40 })
    })

    it('is null outside a pareja, or with no split stored', () => {
        expect(coupleSplitFor(room('tribu', [ana, leo], { a: 60, b: 40 }))).toBeNull()
        expect(coupleSplitFor(room('pareja', [ana, leo], null))).toBeNull()
    })

    it('falls back to half and half when the couple changed', () => {
        // A third person joined: a two-person split no longer describes the tribu.
        expect(coupleSplitFor(room('pareja', [ana, leo, member('c', 'Bea')], { a: 60, b: 40 }))).toBeNull()
        // One of the two left and someone else came in.
        expect(coupleSplitFor(room('pareja', [ana, member('c', 'Bea')], { a: 60, b: 40 }))).toBeNull()
        expect(
            coupleSplitFor(room('pareja', [ana, member('b', 'Leo', '2026-11-20T00:00:00.000Z')], { a: 60, b: 40 }))
        ).toBeNull()
    })

    it('rejects parts that do not add up to 100 or are not whole', () => {
        expect(coupleSplitFor(room('pareja', [ana, leo], { a: 60, b: 50 }))).toBeNull()
        expect(coupleSplitFor(room('pareja', [ana, leo], { a: 60.5, b: 39.5 }))).toBeNull()
        expect(coupleSplitFor(room('pareja', [ana, leo], { a: 100, b: 0 }))).toBeNull()
    })
})

describe('coupleSplitPercentageInputs', () => {
    it('fills the form with the couple percentages', () => {
        expect(coupleSplitPercentageInputs(room('pareja', [ana, leo], { a: 70, b: 30 }))).toEqual({ a: '70', b: '30' })
    })

    it('leaves the usual equal split for 50/50 couples', () => {
        expect(coupleSplitPercentageInputs(room('pareja', [ana, leo], { a: 50, b: 50 }))).toBeNull()
        expect(coupleSplitPercentageInputs(room('pareja', [ana, leo], null))).toBeNull()
    })
})

describe('coupleSplitFromPercent', () => {
    it('gives the first person the chosen part and the other the rest', () => {
        expect(coupleSplitFromPercent([ana, leo], 60)).toEqual({ a: 60, b: 40 })
        expect(coupleSplitFromPercent([ana, leo], 30)).toEqual({ a: 30, b: 70 })
    })

    it('stores nothing for half and half', () => {
        expect(coupleSplitFromPercent([ana, leo], 50)).toBeNull()
    })
})

describe('couple presets', () => {
    it('point at real catalog subjects, so each gets its drawing', () => {
        for (const preset of COUPLE_EXPENSES) expect(getExpenseSubject(preset.category).id).toBe(preset.category)
    })

    it('finds a preset by id and ignores unknown ones', () => {
        expect(coupleExpense('alquiler')?.monthly).toBe(true)
        expect(coupleExpense('nope')).toBeNull()
        expect(coupleExpense('')).toBeNull()
    })

    it('names the tribu after the two', () => {
        expect(coupleRoomName(' Ana ', 'Leo', 'y')).toBe('Ana y Leo')
        expect(coupleRoomName('Ana', '', 'y')).toBe('Ana')
    })
})

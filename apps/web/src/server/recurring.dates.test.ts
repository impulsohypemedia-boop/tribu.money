import { describe, expect, it } from 'vitest'
import { dueMonths, monthKey, nextMonthKey, occurrenceDate } from './recurring'

describe('monthly dates', () => {
    it('rolls the year over', () => {
        expect(nextMonthKey('2026-12')).toBe('2027-01')
        expect(nextMonthKey('2026-01')).toBe('2026-02')
    })

    it('moves day 31 to the last day of a shorter month', () => {
        expect(occurrenceDate('2026-02', 31).toISOString().slice(0, 10)).toBe('2026-02-28')
        expect(occurrenceDate('2028-02', 31).toISOString().slice(0, 10)).toBe('2028-02-29')
        expect(occurrenceDate('2026-04', 31).toISOString().slice(0, 10)).toBe('2026-04-30')
    })

    it('owes a month only once its day has come', () => {
        const now = new Date('2026-11-20T15:00:00Z')
        expect(dueMonths('2026-11', 25, now)).toEqual([])
        expect(dueMonths('2026-11', 5, now)).toEqual(['2026-11'])
        expect(dueMonths('2026-08', 5, now)).toEqual(['2026-08', '2026-09', '2026-10', '2026-11'])
        expect(dueMonths('2026-12', 1, now)).toEqual([])
    })

    it('caps a long-forgotten template', () => {
        expect(dueMonths('2020-01', 1, new Date('2026-11-20T00:00:00Z'), 12)).toHaveLength(12)
    })

    it('counts months in UTC', () => {
        expect(monthKey(new Date('2026-11-30T23:30:00Z'))).toBe('2026-11')
    })
})

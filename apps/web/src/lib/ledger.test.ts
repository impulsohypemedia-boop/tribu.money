import { describe, expect, it } from 'vitest'
import { balancesOf } from '@/server/roomState'
import {
    contributionLines,
    expenseLines,
    ledgerWritesFor,
    memberBalancesFromLines,
    sameMoney,
    settlementLines,
    sumLines,
    type LedgerLine,
} from './ledger'

const expense = {
    id: 'e1',
    paidById: 'ana',
    baseAmountMinor: 1001n,
    potId: null,
    shares: [
        { memberId: 'ana', amountMinor: 334n },
        { memberId: 'bea', amountMinor: 334n },
        { memberId: 'cai', amountMinor: 333n },
    ],
}
const settlement = { id: 's1', fromId: 'bea', toId: 'ana', amountMinor: 334n }

describe('ledger rules', () => {
    it('gives every movement balanced lines', () => {
        expect(sumLines(expenseLines(expense, new Map()))).toBe(0n)
        expect(sumLines(expenseLines({ ...expense, potId: 'p1' }, new Map([['p1', 'ana']])))).toBe(0n)
        expect(sumLines(settlementLines(settlement))).toBe(0n)
        expect(sumLines(contributionLines({ id: 'c1', potId: 'p1', amountMinor: 50n }, 'ana'))).toBe(0n)
    })

    it('lands on the same member balances as the fold over the rows', () => {
        const lines = [...expenseLines(expense, new Map()), ...settlementLines(settlement)]
        const fromBook = memberBalancesFromLines(['ana', 'bea', 'cai'], lines)
        const folded = balancesOf({
            members: [{ id: 'ana' }, { id: 'bea' }, { id: 'cai' }],
            expenses: [expense],
            settlements: [settlement],
        })
        expect(fromBook).toEqual(folded)
    })

    it('touches the pot only when its keeper paid', () => {
        const keepers = new Map([['p1', 'ana']])
        const byKeeper = expenseLines({ ...expense, potId: 'p1' }, keepers)
        expect(byKeeper).toContainEqual({ accountType: 'pot', accountId: 'p1', amountMinor: -1001n })
        const bySomeoneElse = expenseLines({ ...expense, potId: 'p1', paidById: 'bea' }, keepers)
        expect(bySomeoneElse.some((line) => line.accountType === 'pot')).toBe(false)
    })

    it('writes nothing for an unchanged movement, even when lines are split differently', () => {
        const live = { id: 1n, lines: expenseLines(expense, new Map()) }
        const regrouped: LedgerLine[] = [
            { accountType: 'member', accountId: 'ana', amountMinor: 667n },
            { accountType: 'member', accountId: 'bea', amountMinor: -334n },
            { accountType: 'member', accountId: 'cai', amountMinor: -333n },
        ]
        expect(sameMoney(live.lines, regrouped)).toBe(true)
        expect(ledgerWritesFor(live, regrouped)).toEqual([])
    })

    it('reverses then records on a change, only reverses on a delete, only records when new', () => {
        const live = { id: 7n, lines: settlementLines(settlement) }
        const changed = settlementLines({ ...settlement, amountMinor: 100n })
        const writes = ledgerWritesFor(live, changed)
        expect(writes.map((write) => write.kind)).toEqual(['reversal', 'record'])
        expect(writes[0]).toMatchObject({ reversesId: 7n })
        expect(sumLines([...live.lines, ...writes[0].lines])).toBe(0n)
        expect(writes[0].lines.map((line) => line.amountMinor)).toEqual([-334n, 334n])

        expect(ledgerWritesFor(live, null).map((write) => write.kind)).toEqual(['reversal'])
        expect(ledgerWritesFor(null, changed).map((write) => write.kind)).toEqual(['record'])
        expect(ledgerWritesFor(null, null)).toEqual([])
    })

    it('refuses lines that do not balance', () => {
        expect(() => ledgerWritesFor(null, [{ accountType: 'member', accountId: 'ana', amountMinor: 1n }])).toThrow(
            /balance/
        )
    })
})

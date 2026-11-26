/**
 * The tribu's book of account, as pure rules: which postings each money movement should have,
 * and what has to be written to bring the book in line with the movements as they are now.
 * `src/server/ledger.ts` does the reading and writing; this file decides, so it can be tested
 * without a database. Amounts are room-currency minor units; nothing here goes through Number.
 */

export type LedgerAccountType = 'member' | 'pot' | 'keeper'
export type LedgerSourceType = 'expense' | 'settlement' | 'pot_contribution'

export interface LedgerLine {
    accountType: LedgerAccountType
    accountId: string
    amountMinor: bigint
}

export interface LedgerExpense {
    id: string
    paidById: string
    baseAmountMinor: bigint
    potId: string | null
    shares: readonly { memberId: string; amountMinor: bigint }[]
}

export interface LedgerSettlement {
    id: string
    fromId: string
    toId: string
    amountMinor: bigint
}

export interface LedgerContribution {
    id: string
    potId: string
    amountMinor: bigint
}

/**
 * The payer puts the whole amount in and each person takes their part out, so a member's
 * postings add up to the same balance `balancesOf` folds. When a vaquita paid (its keeper is the
 * payer, as in `potSummary`), the money also leaves the pot and the keeper's hands.
 */
export function expenseLines(expense: LedgerExpense, potKeeperById: ReadonlyMap<string, string>): LedgerLine[] {
    const lines: LedgerLine[] = [
        { accountType: 'member', accountId: expense.paidById, amountMinor: expense.baseAmountMinor },
        ...expense.shares.map((share) => ({
            accountType: 'member' as const,
            accountId: share.memberId,
            amountMinor: -share.amountMinor,
        })),
    ]
    if (expense.potId && potKeeperById.get(expense.potId) === expense.paidById) {
        lines.push(
            { accountType: 'pot', accountId: expense.potId, amountMinor: -expense.baseAmountMinor },
            { accountType: 'keeper', accountId: expense.paidById, amountMinor: expense.baseAmountMinor }
        )
    }
    return lines
}

export const settlementLines = (settlement: LedgerSettlement): LedgerLine[] => [
    { accountType: 'member', accountId: settlement.fromId, amountMinor: settlement.amountMinor },
    { accountType: 'member', accountId: settlement.toId, amountMinor: -settlement.amountMinor },
]

/** Money into a vaquita, held by its keeper. The member side is the payment to the keeper, which
 *  is a settlement of its own (none when the keeper put money in their own pot). */
export const contributionLines = (contribution: LedgerContribution, keeperId: string): LedgerLine[] => [
    { accountType: 'pot', accountId: contribution.potId, amountMinor: contribution.amountMinor },
    { accountType: 'keeper', accountId: keeperId, amountMinor: -contribution.amountMinor },
]

const accountKey = (line: Pick<LedgerLine, 'accountType' | 'accountId'>) => `${line.accountType}:${line.accountId}`

/** Net per account, zeros dropped: two line lists that move the same money compare equal. */
export function netByAccount(lines: readonly LedgerLine[]): Map<string, bigint> {
    const net = new Map<string, bigint>()
    for (const line of lines) {
        const key = accountKey(line)
        net.set(key, (net.get(key) ?? 0n) + line.amountMinor)
    }
    for (const [key, amount] of net) if (amount === 0n) net.delete(key)
    return net
}

export function sameMoney(a: readonly LedgerLine[], b: readonly LedgerLine[]): boolean {
    const left = netByAccount(a)
    const right = netByAccount(b)
    if (left.size !== right.size) return false
    for (const [key, amount] of left) if (right.get(key) !== amount) return false
    return true
}

export const sumLines = (lines: readonly LedgerLine[]): bigint =>
    lines.reduce((total, line) => total + line.amountMinor, 0n)

/** The record of a source that no reversal has cancelled yet. */
export interface LiveRecord {
    id: bigint
    lines: readonly LedgerLine[]
}

export type LedgerWrite =
    { kind: 'reversal'; reversesId: bigint; lines: LedgerLine[] } | { kind: 'record'; lines: LedgerLine[] }

/**
 * What to append for one source. `wanted` is null when the movement no longer counts (deleted).
 * An unchanged movement writes nothing; a changed one cancels its live record and records again;
 * a deleted one only cancels; a new or restored one only records.
 */
export function ledgerWritesFor(live: LiveRecord | null, wanted: readonly LedgerLine[] | null): LedgerWrite[] {
    if (wanted && sumLines(wanted) !== 0n) throw new Error('a ledger entry must balance')
    if (live && wanted && sameMoney(live.lines, wanted)) return []
    const writes: LedgerWrite[] = []
    if (live) {
        writes.push({
            kind: 'reversal',
            reversesId: live.id,
            lines: live.lines.map((line) => ({ ...line, amountMinor: -line.amountMinor })),
        })
    }
    if (wanted) writes.push({ kind: 'record', lines: [...wanted] })
    return writes
}

/** Member balances from postings: the same numbers `balancesOf` produces, read from the book. */
export function memberBalancesFromLines(
    memberIds: readonly string[],
    lines: readonly Pick<LedgerLine, 'accountType' | 'accountId' | 'amountMinor'>[]
): Map<string, bigint> {
    const balances = new Map<string, bigint>(memberIds.map((id) => [id, 0n]))
    for (const line of lines) {
        if (line.accountType !== 'member') continue
        const current = balances.get(line.accountId)
        if (current !== undefined) balances.set(line.accountId, current + line.amountMinor)
    }
    return balances
}

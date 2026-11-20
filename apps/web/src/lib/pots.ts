/**
 * La vaquita, as the room sees it: how much went in, how much the pot paid, how much is left
 * in the keeper's account, and how far the goal is. Amounts are room-currency minor units as
 * strings; nothing here goes through Number.
 *
 * The money itself is already in the balances: a contribution is a payment to the keeper and a
 * pot expense is an expense the keeper paid (see `src/server/pots.ts`). This file only reads.
 */
import type { ApiPot, RoomState } from './api-types'
import { defaultSplitMembers } from './members'
import { localMonthKey, shiftLocalMonth } from './month-summary'

export interface PotSummary {
    contributedMinor: string
    spentMinor: string
    /** In the keeper's account now. Negative when the keeper paid more than the pot had. */
    heldMinor: string
    /** 0–100, against the target. Null without a target. */
    progressPct: number | null
    /** Still missing to reach the target; "0" once reached. Null without a target. */
    missingMinor: string | null
    /** Per person, most first. */
    byMember: { memberId: string; amountMinor: string }[]
    /** Who still has to put this month's quota in, with what is missing. Empty without a quota. */
    quotaMissing: { memberId: string; amountMinor: string }[]
    /** Month (YYYY-MM) the target is reached at the current pace. Null when it cannot be told. */
    projectedMonth: string | null
    /** What each person would put per month to reach the target by the due date. */
    suggestedQuotaMinor: string | null
    /** Expenses the pot paid, newest first. */
    expenseIds: string[]
}

const ceilDiv = (a: bigint, b: bigint) => (a + b - 1n) / b

const monthsBetween = (from: string, to: string) => {
    const [fy, fm] = from.split('-').map(Number)
    const [ty, tm] = to.split('-').map(Number)
    return (ty - fy) * 12 + (tm - fm)
}

export function potSummary(pot: ApiPot, state: RoomState, now = new Date()): PotSummary {
    const thisMonth = localMonthKey(now)
    let contributed = 0n
    const byMember = new Map<string, bigint>()
    const thisMonthBy = new Map<string, bigint>()
    for (const contribution of pot.contributions) {
        const amount = BigInt(contribution.amountMinor)
        contributed += amount
        byMember.set(contribution.memberId, (byMember.get(contribution.memberId) ?? 0n) + amount)
        if (localMonthKey(new Date(contribution.createdAt)) === thisMonth)
            thisMonthBy.set(contribution.memberId, (thisMonthBy.get(contribution.memberId) ?? 0n) + amount)
    }

    // An expense counts only while the keeper is its payer: that is where the pot's money is.
    const potExpenses = state.expenses.filter(
        (expense) => expense.potId === pot.id && expense.paidById === pot.keeperId
    )
    const spent = potExpenses.reduce((sum, expense) => sum + BigInt(expense.baseAmountMinor), 0n)

    const target = pot.targetMinor ? BigInt(pot.targetMinor) : null
    const missing = target === null ? null : contributed >= target ? 0n : target - contributed
    const progressPct =
        target === null || target === 0n
            ? null
            : Number(((contributed >= target ? target : contributed) * 100n) / target)

    const quota = pot.quotaMinor ? BigInt(pot.quotaMinor) : null
    const quotaPeople = defaultSplitMembers(state.members)
    const quotaMissing =
        quota === null
            ? []
            : quotaPeople.flatMap((member) => {
                  const put = thisMonthBy.get(member.id) ?? 0n
                  return put >= quota ? [] : [{ memberId: member.id, amountMinor: (quota - put).toString() }]
              })

    let projectedMonth: string | null = null
    let suggestedQuota: bigint | null = null
    if (missing !== null && missing > 0n) {
        const elapsed = BigInt(Math.max(1, monthsBetween(localMonthKey(new Date(pot.createdAt)), thisMonth) + 1))
        const pace = quota !== null ? quota * BigInt(quotaPeople.length) : contributed / elapsed
        if (pace > 0n) {
            // This month still counts when its quota is not all in yet.
            const startOffset = quota !== null && quotaMissing.length > 0 ? -1 : 0
            projectedMonth = shiftLocalMonth(thisMonth, Number(ceilDiv(missing, pace)) + startOffset)
        }
        if (pot.dueDate && quotaPeople.length > 0) {
            const monthsLeft = BigInt(Math.max(1, monthsBetween(thisMonth, localMonthKey(new Date(pot.dueDate))) + 1))
            suggestedQuota = ceilDiv(missing, monthsLeft * BigInt(quotaPeople.length))
        }
    }

    return {
        contributedMinor: contributed.toString(),
        spentMinor: spent.toString(),
        heldMinor: (contributed - spent).toString(),
        progressPct,
        missingMinor: missing?.toString() ?? null,
        byMember: [...byMember.entries()]
            .sort((a, b) => (b[1] > a[1] ? 1 : b[1] < a[1] ? -1 : 0))
            .map(([memberId, amount]) => ({ memberId, amountMinor: amount.toString() })),
        quotaMissing,
        projectedMonth,
        suggestedQuotaMinor: suggestedQuota?.toString() ?? null,
        expenseIds: potExpenses.map((expense) => expense.id),
    }
}

export const openPots = (state: RoomState): ApiPot[] => (state.pots ?? []).filter((pot) => !pot.closedAt)

/** The settlement ids that are contributions, so the feed can label them as the vaquita's. */
export function potBySettlement(state: RoomState): Map<string, ApiPot> {
    const map = new Map<string, ApiPot>()
    for (const pot of state.pots ?? [])
        for (const contribution of pot.contributions)
            if (contribution.settlementId) map.set(contribution.settlementId, pot)
    return map
}

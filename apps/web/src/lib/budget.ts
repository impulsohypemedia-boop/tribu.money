/**
 * Presupuesto del grupo: how much of each monthly limit the tribu has already used.
 *
 * The idea of a limit per period with "spent" and "left" bars and a warning before running out
 * comes from Firefly III (AGPL-3.0, firefly-iii.org); no code was copied. Spending is read from
 * the month's expenses in room currency, so a limit never changes a balance.
 */
import type { ApiBudget, RoomState } from './api-types'
import { EXPENSE_CATEGORY_IDS, expenseCategoryOf, type ExpenseCategoryId } from './expense-category'
import { localMonthKey } from './month-summary'

/** The budget for the whole month, across every category. */
export const TOTAL_BUDGET = 'total'

/** Share of a limit, in percent, from which the tribu is told it is getting close. */
export const NEAR_LIMIT_PCT = 80

export type BudgetCategory = typeof TOTAL_BUDGET | ExpenseCategoryId

const budgetCategories = new Set<string>([TOTAL_BUDGET, ...EXPENSE_CATEGORY_IDS])

export const isBudgetCategory = (value: string): value is BudgetCategory => budgetCategories.has(value)

export type BudgetLevel = 'ok' | 'near' | 'over'

export interface BudgetLine {
    category: BudgetCategory
    limitMinor: string
    spentMinor: string
    /** Positive while there is room left, negative once the limit is passed. */
    leftMinor: string
    /** Whole percent of the limit used, rounded down; can pass 100. */
    usedPct: number
    level: BudgetLevel
}

const levelOf = (spent: bigint, limit: bigint): BudgetLevel => {
    if (spent > limit) return 'over'
    if (spent * 100n >= limit * BigInt(NEAR_LIMIT_PCT)) return 'near'
    return 'ok'
}

/** Every limit with what the month used of it: the month total first, then categories by use. */
export function budgetLines(
    state: Pick<RoomState, 'expenses' | 'budgets'>,
    month: string = localMonthKey(new Date())
): BudgetLine[] {
    const budgets = (state.budgets ?? []).filter((budget) => isBudgetCategory(budget.category))
    if (budgets.length === 0) return []

    const spent = new Map<string, bigint>()
    let total = 0n
    for (const expense of state.expenses) {
        if (localMonthKey(new Date(expense.date)) !== month) continue
        const amount = BigInt(expense.baseAmountMinor)
        total += amount
        const category = expenseCategoryOf(expense)
        spent.set(category, (spent.get(category) ?? 0n) + amount)
    }

    return budgets
        .map((budget: ApiBudget): BudgetLine => {
            const limit = BigInt(budget.amountMinor)
            const used = budget.category === TOTAL_BUDGET ? total : (spent.get(budget.category) ?? 0n)
            return {
                category: budget.category as BudgetCategory,
                limitMinor: limit.toString(),
                spentMinor: used.toString(),
                leftMinor: (limit - used).toString(),
                usedPct: limit === 0n ? (used > 0n ? 100 : 0) : Number((used * 100n) / limit),
                level: limit === 0n ? (used > 0n ? 'over' : 'ok') : levelOf(used, limit),
            }
        })
        .sort(
            (a, b) =>
                Number(b.category === TOTAL_BUDGET) - Number(a.category === TOTAL_BUDGET) ||
                b.usedPct - a.usedPct ||
                a.category.localeCompare(b.category)
        )
}

/** The limits the tribu should hear about this month: passed ones first, then close ones. */
export const budgetAlerts = (lines: readonly BudgetLine[]): BudgetLine[] =>
    lines
        .filter((line) => line.level !== 'ok')
        .sort((a, b) => Number(b.level === 'over') - Number(a.level === 'over') || b.usedPct - a.usedPct)

'use client'

import { useMemo, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { CloseButton } from '@/components/ui/CloseButton'
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/Drawer'
import { DrawerBody } from '@/components/ui/DrawerLayout'
import { Icon } from '@/components/ui/Icon'
import type { CurrencyInfo, RoomState } from '@/lib/api-types'
import { EXPENSE_CATEGORY_IDS, type ExpenseCategoryId } from '@/lib/expense-category'
import { localMonthKey, monthSummary, monthsWithExpenses, shiftLocalMonth } from '@/lib/month-summary'
import { budgetLines } from '@/lib/budget'
import { categoryKey } from './HistoryStats'
import { Money } from './Money'

const knownCategories = new Set<string>(EXPENSE_CATEGORY_IDS)

const monthDate = (key: string) => {
    const [year, month] = key.split('-').map(Number)
    return new Date(year, month - 1, 1)
}

/** Whole-number percentage of `part` in `total`, rounded, without leaving BigInt. */
const percentOf = (part: string, total: string): number => {
    const whole = BigInt(total)
    if (whole === 0n) return 0
    return Number((BigInt(part) * 100n + whole / 2n) / whole)
}

/**
 * "Resumen del mes": a card on the room that opens the month's summary. The summary says what
 * the tribu spent together, on what, and what each person put in next to their part. It is
 * worded as a team total, never as a ranking of who owes most.
 */
export function MonthSummaryCard({
    state,
    currencies,
    onOpenHistory,
}: {
    state: RoomState
    currencies?: readonly CurrencyInfo[]
    onOpenHistory?: () => void
}) {
    const t = useTranslations('room.monthSummary')
    const tHistory = useTranslations('room.history')
    const locale = useLocale()
    const currentMonth = localMonthKey(new Date())
    const [open, setOpen] = useState(false)
    const [month, setMonth] = useState(currentMonth)
    const months = useMemo(() => monthsWithExpenses(state), [state])
    const summary = useMemo(() => monthSummary(state, month), [state, month])
    const current = useMemo(() => monthSummary(state, currentMonth), [state, currentMonth])
    const limits = useMemo(
        () => new Map(budgetLines(state, month).map((line) => [line.category as string, line])),
        [state, month]
    )
    const tBudget = useTranslations('room.budget')

    if (state.expenses.length === 0) return null

    const monthLabel = (key: string) =>
        new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(monthDate(key))
    const nameOf = (id: string) => state.members.find((member) => member.id === id)?.name ?? t('someone')
    const categoryLabel = (category: string) =>
        knownCategories.has(category)
            ? tHistory(`categories.${categoryKey[category as ExpenseCategoryId]}`)
            : category === 'other'
              ? tHistory('categories.other')
              : category
    const biggest = state.expenses.find((expense) => expense.id === summary.biggestExpenseId)
    const earliest = months[0] ?? currentMonth
    const canGoBack = month > earliest
    const canGoForward = month < currentMonth

    const change = (() => {
        const now = BigInt(summary.totalMinor)
        const before = BigInt(summary.previousTotalMinor)
        if (before === 0n) return null
        const pct = percentOf((now > before ? now - before : before - now).toString(), before.toString())
        if (pct === 0) return t('sameAsBefore')
        return now > before ? t('moreThanBefore', { pct }) : t('lessThanBefore', { pct })
    })()

    return (
        <>
            <button
                type="button"
                onClick={() => {
                    setMonth(currentMonth)
                    setOpen(true)
                }}
                className="shadow-4 mb-4 flex w-full items-center gap-3 rounded-sm border border-n-1 bg-white p-3 text-left transition-transform active:translate-y-[2px]"
                data-testid="month-summary-card"
            >
                <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-secondary-1/30">
                    <Icon name="calendar" size={20} />
                </span>
                <span className="min-w-0 flex-1">
                    <span className="block text-h8">{t('cardTitle')}</span>
                    <span className="block truncate text-sm text-grey-1">
                        {t.rich('cardLine', {
                            count: current.expenseCount,
                            amount: () => (
                                <Money minor={current.totalMinor} currency={state.room.currency} catalog={currencies} />
                            ),
                        })}
                    </span>
                </span>
                <Icon name="chevron-right" size={18} className="shrink-0 text-grey-1" />
            </button>

            <Drawer open={open} onOpenChange={(next) => !next && setOpen(false)}>
                <DrawerContent data-testid="month-summary">
                    <DrawerHeader className="flex flex-row items-end justify-between">
                        <DrawerTitle className="text-h5">{t('title')}</DrawerTitle>
                        <CloseButton onClick={() => setOpen(false)} label={t('close')} />
                    </DrawerHeader>
                    <DrawerBody>
                        <div className="flex items-center justify-between gap-2">
                            <button
                                type="button"
                                aria-label={t('previousMonth')}
                                disabled={!canGoBack}
                                onClick={() => setMonth(shiftLocalMonth(month, -1))}
                                className="flex size-10 items-center justify-center rounded-full border border-n-1 bg-white disabled:opacity-30"
                            >
                                <Icon name="arrow-left" size={18} />
                            </button>
                            <span className="text-h7 capitalize" data-testid="month-summary-month">
                                {monthLabel(month)}
                            </span>
                            <button
                                type="button"
                                aria-label={t('nextMonth')}
                                disabled={!canGoForward}
                                onClick={() => setMonth(shiftLocalMonth(month, 1))}
                                className="flex size-10 items-center justify-center rounded-full border border-n-1 bg-white disabled:opacity-30"
                            >
                                <Icon name="arrow-right" size={18} />
                            </button>
                        </div>

                        {summary.expenseCount === 0 ? (
                            <p className="py-8 text-center text-sm text-grey-1">{t('quietMonth')}</p>
                        ) : (
                            <div className="mt-4 grid gap-5">
                                <div className="rounded-sm border border-n-1 bg-primary-3/40 p-4 text-center">
                                    <p className="text-sm text-grey-1">{t('together')}</p>
                                    <Money
                                        minor={summary.totalMinor}
                                        currency={state.room.currency}
                                        catalog={currencies}
                                        className="block text-h3"
                                    />
                                    <p className="text-sm text-grey-1">
                                        {t('expenseCount', { count: summary.expenseCount })}
                                        {change ? ` · ${change}` : ''}
                                    </p>
                                </div>

                                <section className="grid gap-2">
                                    <h3 className="text-h8 uppercase tracking-wide text-grey-1">{t('onWhat')}</h3>
                                    <ul className="grid gap-2">
                                        {summary.categories.map((line) => {
                                            const pct = percentOf(line.amountMinor, summary.totalMinor)
                                            const limit = limits.get(line.category)
                                            return (
                                                <li key={line.category} className="grid gap-1">
                                                    <span className="flex justify-between gap-2 text-sm">
                                                        <span className="truncate">{categoryLabel(line.category)}</span>
                                                        <span className="shrink-0 font-bold">
                                                            <Money
                                                                minor={line.amountMinor}
                                                                currency={state.room.currency}
                                                                catalog={currencies}
                                                            />{' '}
                                                            <span className="font-normal text-grey-1">
                                                                {limit ? (
                                                                    <>
                                                                        {tBudget('limit')}{' '}
                                                                        <Money
                                                                            minor={limit.limitMinor}
                                                                            currency={state.room.currency}
                                                                            catalog={currencies}
                                                                        />
                                                                    </>
                                                                ) : (
                                                                    `${pct}%`
                                                                )}
                                                            </span>
                                                        </span>
                                                    </span>
                                                    <span className="h-2 overflow-hidden rounded-full bg-n-1/10">
                                                        <span
                                                            className={`block h-full rounded-full ${limit?.level === 'over' ? 'bg-error-3' : 'bg-primary-1'}`}
                                                            style={{
                                                                width: `${Math.min(Math.max(limit ? limit.usedPct : pct, 2), 100)}%`,
                                                            }}
                                                        />
                                                    </span>
                                                </li>
                                            )
                                        })}
                                    </ul>
                                </section>

                                <section className="grid gap-2">
                                    <h3 className="text-h8 uppercase tracking-wide text-grey-1">{t('eachOne')}</h3>
                                    <ul className="grid gap-1">
                                        {summary.members.map((line) => (
                                            <li
                                                key={line.memberId}
                                                className="flex items-center justify-between gap-2 rounded-sm border border-n-1 bg-white px-3 py-2 text-sm"
                                            >
                                                <span className="truncate font-bold">{nameOf(line.memberId)}</span>
                                                <span className="shrink-0 text-right text-grey-1">
                                                    {t('put')}{' '}
                                                    <Money
                                                        minor={line.paidMinor}
                                                        currency={state.room.currency}
                                                        catalog={currencies}
                                                        className="font-bold text-n-1"
                                                    />{' '}
                                                    · {t('part')}{' '}
                                                    <Money
                                                        minor={line.shareMinor}
                                                        currency={state.room.currency}
                                                        catalog={currencies}
                                                    />
                                                </span>
                                            </li>
                                        ))}
                                    </ul>
                                </section>

                                {biggest && (
                                    <p className="text-sm text-grey-1">
                                        {t.rich('biggest', {
                                            name: biggest.description || t('unnamed'),
                                            amount: () => (
                                                <Money
                                                    minor={biggest.baseAmountMinor}
                                                    currency={state.room.currency}
                                                    catalog={currencies}
                                                    className="font-bold text-n-1"
                                                />
                                            ),
                                        })}
                                    </p>
                                )}
                            </div>
                        )}

                        {onOpenHistory && (
                            <button
                                type="button"
                                onClick={() => {
                                    setOpen(false)
                                    onOpenHistory()
                                }}
                                className="mt-6 w-full text-center text-sm font-bold underline"
                            >
                                {t('fullHistory')}
                            </button>
                        )}
                    </DrawerBody>
                </DrawerContent>
            </Drawer>
        </>
    )
}

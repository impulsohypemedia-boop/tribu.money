'use client'

import { useMemo, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { CloseButton } from '@/components/ui/CloseButton'
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/Drawer'
import { DrawerBody } from '@/components/ui/DrawerLayout'
import { Doodle } from '@/components/ui/Doodle'
import { Icon } from '@/components/ui/Icon'
import type { CurrencyInfo, RoomState } from '@/lib/api-types'
import { EXPENSE_CATEGORY_IDS, type ExpenseCategoryId } from '@/lib/expense-category'
import { localMonthKey, monthSummary, monthsWithExpenses, shiftLocalMonth } from '@/lib/month-summary'
import { budgetLines } from '@/lib/budget'
import { categoryKey } from './HistoryStats'
import { RONDA_LIME, RONDA_ORANGE, RONDA_PINK, RONDA_TEAL, RONDA_VIOLET, RONDA_YELLOW } from './CoupleStickers'
import { MemberAvatar } from './MemberAvatar'
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

    const categoryColor = (index: number) => RONDA_RING[index % RONDA_RING.length]
    const shortMonth = (key: string) => new Intl.DateTimeFormat(locale, { month: 'long' }).format(monthDate(key))
    const money = (minor: string, className?: string, code = state.room.currency) => (
        <Money minor={minor} currency={code} catalog={currencies} className={className} />
    )

    return (
        <>
            <button
                type="button"
                onClick={() => {
                    setMonth(currentMonth)
                    setOpen(true)
                }}
                className="card-ronda mb-4 grid w-full gap-3 p-4 text-left transition-transform active:translate-y-[2px]"
                data-testid="month-summary-card"
            >
                <span className="flex items-center gap-3">
                    <span
                        className="flex size-10 shrink-0 items-center justify-center rounded-full border-2 border-[#141414]"
                        style={{ backgroundColor: RONDA_YELLOW }}
                    >
                        <Icon name="calendar" size={20} />
                    </span>
                    <span className="min-w-0 flex-1 text-h8 first-letter:uppercase">
                        {t('cardMonth', { month: shortMonth(currentMonth) })}
                    </span>
                    <Icon name="chevron-right" size={18} className="shrink-0 text-grey-1" />
                </span>
                {current.expenseCount > 0 ? (
                    <>
                        <span className="block">
                            {money(current.totalMinor, 'block font-display text-3xl leading-none')}
                            <span className="mt-1 block text-sm text-grey-1">
                                {t('expenseCount', { count: current.expenseCount })}
                            </span>
                        </span>
                        <CategoryBar lines={current.categories} total={current.totalMinor} colorOf={categoryColor} />
                        {current.converted.length > 0 && (
                            <span className="block text-xs text-grey-1" data-testid="month-summary-card-converted">
                                {t.rich('cardConverted', {
                                    amount: () => (
                                        <>
                                            {current.converted.map((line, index) => (
                                                <span key={line.currency} className="font-bold text-n-1">
                                                    {index > 0 ? ' + ' : ''}
                                                    {money(line.amountMinor, undefined, line.currency)}
                                                </span>
                                            ))}
                                        </>
                                    ),
                                })}
                            </span>
                        )}
                    </>
                ) : (
                    <span className="block text-sm text-grey-1">{t('quietMonth')}</span>
                )}
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
                                className="flex size-10 items-center justify-center rounded-full border-2 border-[#141414] bg-white disabled:opacity-30"
                            >
                                <Icon name="arrow-left" size={18} />
                            </button>
                            <span className="text-h7 first-letter:uppercase" data-testid="month-summary-month">
                                {monthLabel(month)}
                            </span>
                            <button
                                type="button"
                                aria-label={t('nextMonth')}
                                disabled={!canGoForward}
                                onClick={() => setMonth(shiftLocalMonth(month, 1))}
                                className="flex size-10 items-center justify-center rounded-full border-2 border-[#141414] bg-white disabled:opacity-30"
                            >
                                <Icon name="arrow-right" size={18} />
                            </button>
                        </div>

                        {summary.expenseCount === 0 ? (
                            <p className="py-8 text-center text-sm text-grey-1">{t('quietMonth')}</p>
                        ) : (
                            <div className="mt-4 grid gap-6">
                                <section
                                    className="card-ronda relative overflow-hidden p-5 text-center"
                                    style={{ backgroundColor: '#FFF4CC' }}
                                >
                                    <p className="text-sm font-bold uppercase tracking-wide text-grey-1">
                                        {t('together')}
                                    </p>
                                    {money(summary.totalMinor, 'mt-1 block font-display text-4xl leading-tight')}
                                    <p className="mt-1 text-sm text-grey-1">
                                        {t('expenseCount', { count: summary.expenseCount })}
                                        {change ? ` · ${change}` : ''}
                                    </p>
                                </section>

                                {summary.converted.length > 0 && (
                                    <section className="grid gap-2" data-testid="month-summary-converted">
                                        <h3 className="text-h8 uppercase tracking-wide text-grey-1">
                                            {t('convertedTitle')}
                                        </h3>
                                        <ul className="grid gap-2">
                                            {summary.converted.map((line) => (
                                                <li
                                                    key={line.currency}
                                                    className="flex items-center justify-between gap-2 rounded-xl border-2 border-[#141414] bg-white px-3 py-2 text-sm"
                                                >
                                                    {money(line.amountMinor, 'font-bold', line.currency)}
                                                    <span className="text-grey-1">=</span>
                                                    {money(line.baseAmountMinor, 'font-bold')}
                                                </li>
                                            ))}
                                        </ul>
                                        <p className="text-xs text-grey-1">
                                            {t('convertedHint', { currency: state.room.currency })}
                                        </p>
                                    </section>
                                )}

                                <section className="grid gap-3">
                                    <h3 className="text-h8 uppercase tracking-wide text-grey-1">{t('onWhat')}</h3>
                                    <CategoryBar
                                        lines={summary.categories}
                                        total={summary.totalMinor}
                                        colorOf={categoryColor}
                                        tall
                                    />
                                    <ul className="grid gap-2">
                                        {summary.categories.map((line, index) => {
                                            const pct = percentOf(line.amountMinor, summary.totalMinor)
                                            const limit = limits.get(line.category)
                                            return (
                                                <li key={line.category} className="grid gap-1">
                                                    <span className="flex items-center justify-between gap-2 text-sm">
                                                        <span className="flex min-w-0 items-center gap-2">
                                                            <span
                                                                aria-hidden
                                                                className="size-3 shrink-0 rounded-full border-2 border-[#141414]"
                                                                style={{ backgroundColor: categoryColor(index) }}
                                                            />
                                                            <span className="truncate">
                                                                {categoryLabel(line.category)}
                                                            </span>
                                                        </span>
                                                        <span className="shrink-0">
                                                            {money(line.amountMinor, 'font-bold')}{' '}
                                                            <span className="text-grey-1">
                                                                {limit ? (
                                                                    <>
                                                                        {tBudget('limit')} {money(limit.limitMinor)}
                                                                    </>
                                                                ) : (
                                                                    `${pct}%`
                                                                )}
                                                            </span>
                                                        </span>
                                                    </span>
                                                    {limit && (
                                                        <span className="h-2 overflow-hidden rounded-full bg-n-1/10">
                                                            <span
                                                                className={`block h-full rounded-full ${limit.level === 'over' ? 'bg-error-3' : 'bg-primary-1'}`}
                                                                style={{
                                                                    width: `${Math.min(Math.max(limit.usedPct, 2), 100)}%`,
                                                                }}
                                                            />
                                                        </span>
                                                    )}
                                                </li>
                                            )
                                        })}
                                    </ul>
                                </section>

                                <section className="grid gap-2">
                                    <h3 className="text-h8 uppercase tracking-wide text-grey-1">{t('eachOne')}</h3>
                                    <ul className="grid gap-2">
                                        {summary.members.map((line) => {
                                            const member = state.members.find((m) => m.id === line.memberId)
                                            return (
                                                <li
                                                    key={line.memberId}
                                                    className="flex items-center gap-3 rounded-xl border-2 border-[#141414] bg-white px-3 py-2"
                                                >
                                                    <MemberAvatar
                                                        name={nameOf(line.memberId)}
                                                        avatar={member?.avatar}
                                                        size={36}
                                                    />
                                                    <span className="min-w-0 flex-1 truncate font-bold">
                                                        {nameOf(line.memberId)}
                                                    </span>
                                                    <span className="shrink-0 text-right text-sm">
                                                        <span className="block">
                                                            <span className="text-grey-1">{t('put')}</span>{' '}
                                                            {money(line.paidMinor, 'font-bold')}
                                                        </span>
                                                        <span className="block text-xs text-grey-1">
                                                            {t('shareOf')} {money(line.shareMinor)}
                                                        </span>
                                                    </span>
                                                </li>
                                            )
                                        })}
                                    </ul>
                                </section>

                                {biggest && (
                                    <section
                                        className="card-ronda flex items-center gap-3 p-3"
                                        style={{ backgroundColor: '#E8F8F7' }}
                                    >
                                        <span
                                            className="flex size-10 shrink-0 items-center justify-center rounded-full border-2 border-[#141414] bg-white"
                                            aria-hidden
                                        >
                                            <Doodle name="iconreceipt" size={22} weight={1.8} />
                                        </span>
                                        <span className="min-w-0 flex-1">
                                            <span className="block text-xs font-bold uppercase tracking-wide text-grey-1">
                                                {t('biggestTitle')}
                                            </span>
                                            <span className="block truncate font-bold">
                                                {biggest.description || t('unnamed')}
                                            </span>
                                        </span>
                                        {money(biggest.baseAmountMinor, 'shrink-0 font-bold')}
                                    </section>
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

/** The ring colours of the logo, so the month reads in the brand's palette. */
const RONDA_RING = [RONDA_YELLOW, RONDA_TEAL, RONDA_PINK, RONDA_ORANGE, RONDA_VIOLET, RONDA_LIME]

/** One bar split by category, biggest first, in the ring colours. */
function CategoryBar({
    lines,
    total,
    colorOf,
    tall,
}: {
    lines: { category: string; amountMinor: string }[]
    total: string
    colorOf: (index: number) => string
    tall?: boolean
}) {
    if (BigInt(total) <= 0n) return null
    return (
        <span
            aria-hidden
            className={`flex w-full overflow-hidden rounded-full border-2 border-[#141414] bg-white ${tall ? 'h-5' : 'h-3'}`}
        >
            {lines.map((line, index) => (
                <span
                    key={line.category}
                    className="h-full border-r-2 border-[#141414] last:border-r-0"
                    style={{
                        width: `${Math.max(percentOf(line.amountMinor, total), 3)}%`,
                        backgroundColor: colorOf(index),
                    }}
                />
            ))}
        </span>
    )
}

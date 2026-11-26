'use client'

import { useMemo, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { BaseInput } from '@/components/ui/BaseInput'
import { Button } from '@/components/ui/Button'
import { CloseButton } from '@/components/ui/CloseButton'
import { Doodle } from '@/components/ui/Doodle'
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/Drawer'
import { DrawerActions, DrawerBody } from '@/components/ui/DrawerLayout'
import { Icon } from '@/components/ui/Icon'
import type { ApiBudget, CurrencyInfo, RoomState } from '@/lib/api-types'
import { TOTAL_BUDGET, budgetAlerts, budgetLines, type BudgetLine } from '@/lib/budget'
import { useErrorMessage } from '@/lib/error-messages'
import { CURATED_EXPENSE_CATEGORY_IDS, type ExpenseCategoryId } from '@/lib/expense-category'
import { decimalsOf, formatAmountInput, parseAmountToMinor } from '@/lib/money'
import { localMonthKey } from '@/lib/month-summary'
import { useSaveBudgets } from '@/lib/queries/budgets'
import { TOAST_MS } from '@/lib/toasts'
import { categoryKey } from './HistoryStats'
import { Money } from './Money'

const barColor = { ok: 'bg-secondary-1', near: 'bg-primary-1', over: 'bg-error-3' } as const

export function useBudgetCategoryLabel() {
    const t = useTranslations('room.budget')
    const tHistory = useTranslations('room.history')
    return (category: string) =>
        category === TOTAL_BUDGET
            ? t('total')
            : category in categoryKey
              ? tHistory(`categories.${categoryKey[category as ExpenseCategoryId]}`)
              : category
}

/** One limit as a bar: what was spent out of the limit, coloured by how close it is. */
export function BudgetBar({
    line,
    label,
    currency,
    currencies,
}: {
    line: BudgetLine
    label: string
    currency: string
    currencies?: readonly CurrencyInfo[]
}) {
    const t = useTranslations('room.budget')
    const left = BigInt(line.leftMinor)
    return (
        <li className="grid gap-1" data-testid={`budget-line-${line.category}`} data-level={line.level}>
            <span className="flex justify-between gap-2 text-sm">
                <span className="truncate font-bold">{label}</span>
                <span className="shrink-0">
                    <Money minor={line.spentMinor} currency={currency} catalog={currencies} className="font-bold" />{' '}
                    <span className="text-grey-1">
                        {t.rich('ofLimit', {
                            amount: () => <Money minor={line.limitMinor} currency={currency} catalog={currencies} />,
                        })}
                    </span>
                </span>
            </span>
            <span className="h-2.5 overflow-hidden rounded-full bg-n-1/10">
                <span
                    className={`block h-full rounded-full ${barColor[line.level]}`}
                    style={{ width: `${Math.min(Math.max(line.usedPct, 2), 100)}%` }}
                />
            </span>
            <span className={`text-xs ${line.level === 'over' ? 'font-bold text-error' : 'text-grey-1'}`}>
                {left >= 0n
                    ? t.rich('left', {
                          pct: line.usedPct,
                          amount: () => <Money minor={line.leftMinor} currency={currency} catalog={currencies} />,
                      })
                    : t.rich('overBy', {
                          amount: () => <Money minor={(-left).toString()} currency={currency} catalog={currencies} />,
                      })}
            </span>
        </li>
    )
}

/**
 * Presupuesto del grupo on the room: a prompt to set one while the tribu has none, then a card
 * with how the month is going and a warning for each limit that is close or passed. Tapping it
 * opens the bars for every limit and the editor.
 */
export function BudgetCard({ state, currencies }: { state: RoomState; currencies?: readonly CurrencyInfo[] }) {
    const t = useTranslations('room.budget')
    const locale = useLocale()
    const labelOf = useBudgetCategoryLabel()
    const [open, setOpen] = useState(false)
    const [editing, setEditing] = useState(false)
    const month = localMonthKey(new Date())
    const lines = useMemo(() => budgetLines(state, month), [state, month])
    const alerts = budgetAlerts(lines)
    const currency = state.room.currency
    const monthName = new Intl.DateTimeFormat(locale, { month: 'long' }).format(new Date())

    const openEditor = () => {
        setEditing(true)
        setOpen(true)
    }

    const summaryLine = lines.find((line) => line.category === TOTAL_BUDGET) ?? lines[0]

    return (
        <>
            {lines.length === 0 ? (
                <button
                    type="button"
                    onClick={openEditor}
                    className="mb-4 flex w-full items-center gap-3 rounded-sm border border-dashed border-n-1 bg-white/60 p-3 text-left"
                    data-testid="budget-start"
                >
                    <Doodle
                        name="expense_chart_no_axes_column_increasing"
                        size={26}
                        weight={1.8}
                        className="shrink-0"
                    />
                    <span className="grid gap-0.5">
                        <span className="text-h8">{t('start')}</span>
                        <span className="text-sm text-grey-1">{t('startHint')}</span>
                    </span>
                </button>
            ) : (
                <button
                    type="button"
                    onClick={() => {
                        setEditing(false)
                        setOpen(true)
                    }}
                    className="shadow-4 mb-4 grid w-full gap-2 rounded-sm border border-n-1 bg-white p-3 text-left transition-transform active:translate-y-[2px]"
                    data-testid="budget-card"
                >
                    <span className="flex items-center gap-2">
                        <span className="flex-1 text-h8">{t('cardTitle', { month: monthName })}</span>
                        <Icon name="chevron-right" size={18} className="shrink-0 text-grey-1" />
                    </span>
                    {summaryLine && (
                        <ul>
                            <BudgetBar
                                line={summaryLine}
                                label={labelOf(summaryLine.category)}
                                currency={currency}
                                currencies={currencies}
                            />
                        </ul>
                    )}
                    {alerts.slice(0, 2).map((line) => (
                        <span
                            key={line.category}
                            className={`rounded-sm px-2 py-1 text-sm ${line.level === 'over' ? 'bg-error-1/60' : 'bg-primary-3'}`}
                            data-testid="budget-alert"
                        >
                            {line.level === 'over'
                                ? t('alertOver', { category: labelOf(line.category) })
                                : t('alertNear', { category: labelOf(line.category), pct: line.usedPct })}
                        </span>
                    ))}
                </button>
            )}

            <Drawer open={open} onOpenChange={(next) => !next && setOpen(false)}>
                <DrawerContent data-testid="budget-drawer">
                    <DrawerHeader className="flex flex-row items-end justify-between">
                        <DrawerTitle className="text-h5">{editing ? t('editTitle') : t('title')}</DrawerTitle>
                        <CloseButton onClick={() => setOpen(false)} label={t('close')} />
                    </DrawerHeader>
                    {editing ? (
                        <BudgetEditor
                            state={state}
                            currencies={currencies}
                            onDone={() => (lines.length === 0 ? setOpen(false) : setEditing(false))}
                        />
                    ) : (
                        <>
                            <DrawerBody>
                                <p className="mb-4 text-sm text-grey-1">{t('intro', { month: monthName })}</p>
                                <ul className="grid gap-4">
                                    {lines.map((line) => (
                                        <BudgetBar
                                            key={line.category}
                                            line={line}
                                            label={labelOf(line.category)}
                                            currency={currency}
                                            currencies={currencies}
                                        />
                                    ))}
                                </ul>
                            </DrawerBody>
                            <DrawerActions className="px-4 pb-4">
                                <Button
                                    variant="stroke"
                                    onClick={() => setEditing(true)}
                                    data-testid="budget-edit"
                                    className="justify-center"
                                >
                                    {t('edit')}
                                </Button>
                            </DrawerActions>
                        </>
                    )}
                </DrawerContent>
            </Drawer>
        </>
    )
}

/** Every limit as a field: the month total, then the usual categories. An empty field has no limit. */
function BudgetEditor({
    state,
    currencies,
    onDone,
}: {
    state: RoomState
    currencies?: readonly CurrencyInfo[]
    onDone: () => void
}) {
    const t = useTranslations('room.budget')
    const locale = useLocale()
    const labelOf = useBudgetCategoryLabel()
    const errorMessage = useErrorMessage()
    const save = useSaveBudgets(state.room.slug)
    const decimals = decimalsOf(state.room.currency, currencies)
    const saved = state.budgets ?? []
    const categories = [
        TOTAL_BUDGET,
        ...CURATED_EXPENSE_CATEGORY_IDS,
        ...saved
            .map((budget) => budget.category)
            .filter(
                (category) =>
                    category !== TOTAL_BUDGET && !(CURATED_EXPENSE_CATEGORY_IDS as readonly string[]).includes(category)
            ),
    ]
    const [values, setValues] = useState<Record<string, string>>(() =>
        Object.fromEntries(
            saved.map((budget) => [budget.category, formatAmountInput(budget.amountMinor, decimals, locale)])
        )
    )
    const [problem, setProblem] = useState<string | null>(null)

    const submit = async () => {
        const budgets: ApiBudget[] = []
        for (const category of categories) {
            const text = values[category]?.trim()
            if (!text) continue
            const amountMinor = parseAmountToMinor(text, decimals, locale)
            if (amountMinor === null || BigInt(amountMinor) <= 0n)
                return setProblem(t('amountInvalid', { category: labelOf(category) }))
            budgets.push({ category, amountMinor })
        }
        setProblem(null)
        try {
            await save.mutateAsync(budgets)
            toast.success(budgets.length ? t('saved') : t('cleared'), { duration: TOAST_MS.default })
            onDone()
        } catch (error) {
            toast.error(errorMessage(error), { duration: TOAST_MS.actionable })
        }
    }

    return (
        <>
            <DrawerBody>
                <p className="mb-4 text-sm text-grey-1">{t('editHint')}</p>
                <div className="grid gap-3">
                    {categories.map((category) => (
                        <label
                            key={category}
                            className={`grid grid-cols-[1fr_9rem] items-center gap-3 ${category === TOTAL_BUDGET ? 'mb-2 border-b border-n-1/20 pb-4' : ''}`}
                        >
                            <span className={`text-sm ${category === TOTAL_BUDGET ? 'font-bold' : ''}`}>
                                {labelOf(category)}
                            </span>
                            <BaseInput
                                value={values[category] ?? ''}
                                onChange={(event) => setValues({ ...values, [category]: event.target.value })}
                                placeholder={t('noLimit')}
                                inputMode="decimal"
                                autoComplete="off"
                                maxLength={20}
                                className="text-right"
                                data-testid={`budget-input-${category}`}
                            />
                        </label>
                    ))}
                </div>
                {problem && <p className="mt-3 text-sm text-error">{problem}</p>}
            </DrawerBody>
            <DrawerActions className="px-4 pb-4">
                <Button
                    shadowSize="4"
                    className="justify-center"
                    loading={save.isPending}
                    onClick={() => void submit()}
                    data-testid="budget-save"
                >
                    {t('save')}
                </Button>
            </DrawerActions>
        </>
    )
}

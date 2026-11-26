'use client'

import { useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { BaseInput } from '@/components/ui/BaseInput'
import { Button } from '@/components/ui/Button'
import { Doodle } from '@/components/ui/Doodle'
import { Icon } from '@/components/ui/Icon'
import type { CurrencyInfo, RoomState } from '@/lib/api-types'
import { cn } from '@/lib/cn'
import {
    COUPLE_EXPENSES,
    COUPLE_SPLIT_PRESETS,
    coupleMembers,
    coupleSplitFor,
    coupleSplitFromPercent,
    isEvenSplit,
    type CoupleExpenseId,
} from '@/lib/couple'
import { useErrorMessage } from '@/lib/error-messages'
import { getExpenseSubject } from '@/lib/expense-category'
import { decimalsOf, parseAmountToMinor } from '@/lib/money'
import { useSaveCoupleSplit } from '@/lib/queries/couple'
import { useCreatePot } from '@/lib/queries/pots'
import { TOAST_MS } from '@/lib/toasts'

interface Props {
    slug: string
    state: RoomState
    currencies: readonly CurrencyInfo[]
    meId?: string | null
    token?: string | null
    /** Open the new-expense form with one of the couple's typical expenses filled in. */
    onAddTypical: (id: CoupleExpenseId, monthly: boolean) => void
}

/**
 * What a couple's tribu adds on top of a normal one: their typical expenses one tap away and how
 * they split by default. The trips they save for are `CoupleTrips`, placed below the pot cards.
 */
export function CouplePanel(props: Props) {
    return (
        <div className="mb-4 grid gap-4" data-testid="couple-panel">
            <TypicalExpenses onAddTypical={props.onAddTypical} />
            <CoupleSplitCard {...props} />
        </div>
    )
}

function TypicalExpenses({ onAddTypical }: Pick<Props, 'onAddTypical'>) {
    const t = useTranslations('room.couple')
    return (
        <section className="grid gap-2" aria-labelledby="couple-typical-title">
            <div>
                <h2 id="couple-typical-title" className="text-h7">
                    {t('typicalTitle')}
                </h2>
                <p className="text-sm text-grey-1">{t('typicalHint')}</p>
            </div>
            <ul className="grid grid-cols-4 gap-2" data-testid="couple-typical">
                {COUPLE_EXPENSES.map((preset) => (
                    <li key={preset.id}>
                        <button
                            type="button"
                            onClick={() => onAddTypical(preset.id, preset.monthly)}
                            data-testid={`couple-typical-${preset.id}`}
                            className="shadow-4 flex h-full w-full flex-col items-center gap-1 rounded-sm border border-n-1 bg-white px-1 py-2 text-center transition-transform active:translate-y-[2px]"
                        >
                            <span className="flex size-10 items-center justify-center rounded-full border border-n-1 bg-primary-3">
                                <Doodle name={getExpenseSubject(preset.category).doodle} size={24} weight={1.8} />
                            </span>
                            <span className="text-xs font-bold leading-tight">{t(`expenses.${preset.id}`)}</span>
                            {preset.monthly && (
                                <span className="text-[10px] leading-none text-grey-1">{t('monthlyTag')}</span>
                            )}
                        </button>
                    </li>
                ))}
            </ul>
        </section>
    )
}

function CoupleSplitCard({ slug, state, token }: Props) {
    const t = useTranslations('room.couple')
    const errorMessage = useErrorMessage()
    const save = useSaveCoupleSplit(slug, token)
    const [editing, setEditing] = useState(false)
    const [first, second] = coupleMembers(state.members)
    const split = coupleSplitFor(state)
    const firstPct = split && first ? split[first.id] : 50
    const [draft, setDraft] = useState(firstPct)

    // A couple of two. If a third person joined, the split stays half and half and the card says why.
    if (!first || !second) return null
    const threeOrMore = state.members.filter((member) => !member.removedAt).length > 2

    const label = (pct: number) =>
        pct === 50 ? t('splitEven') : t('splitParts', { a: first.name, aPct: pct, b: second.name, bPct: 100 - pct })

    const commit = async () => {
        try {
            await save.mutateAsync(coupleSplitFromPercent(state.members, draft))
            setEditing(false)
            toast.success(t('splitSaved'), { duration: TOAST_MS.default })
        } catch (error) {
            toast.error(errorMessage(error), { duration: TOAST_MS.actionable })
        }
    }

    const options = [...new Set([...COUPLE_SPLIT_PRESETS, ...COUPLE_SPLIT_PRESETS.map((pct) => 100 - pct)])].sort(
        (a, b) => b - a
    )

    return (
        <section className="rounded-sm border border-n-1 bg-white p-3" data-testid="couple-split">
            <div className="flex items-center gap-3">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-full border border-n-1 bg-primary-3">
                    <Doodle name="expense_heart_handshake" size={24} weight={1.8} />
                </span>
                <span className="min-w-0 flex-1">
                    <span className="block text-h8">{t('splitTitle')}</span>
                    <span className="block text-sm text-grey-1" data-testid="couple-split-now">
                        {threeOrMore ? t('splitThree') : label(isEvenSplit(split) ? 50 : firstPct)}
                    </span>
                </span>
                {!editing && !threeOrMore && (
                    <Button
                        variant="stroke"
                        width="auto"
                        className="shrink-0 px-3 text-sm"
                        onClick={() => {
                            setDraft(firstPct)
                            setEditing(true)
                        }}
                        data-testid="couple-split-edit"
                    >
                        {t('splitChange')}
                    </Button>
                )}
            </div>
            {editing && (
                <div className="mt-3 grid gap-3">
                    <p className="text-sm text-grey-1">{t('splitHint', { a: first.name })}</p>
                    <div className="grid gap-2" role="radiogroup" aria-label={t('splitTitle')}>
                        {options.map((pct) => (
                            <button
                                key={pct}
                                type="button"
                                role="radio"
                                aria-checked={draft === pct}
                                onClick={() => setDraft(pct)}
                                data-testid={`couple-split-${pct}`}
                                className={cn(
                                    'flex items-center justify-between rounded-sm border border-n-1 px-3 py-2 text-left text-sm font-bold',
                                    draft === pct ? 'bg-n-1 text-white' : 'bg-white'
                                )}
                            >
                                <span>{label(pct)}</span>
                                {draft === pct && <Icon name="check" size={16} />}
                            </button>
                        ))}
                    </div>
                    <p className="text-xs text-grey-1">{t('splitAppliesTo')}</p>
                    <div className="flex gap-2">
                        <Button
                            variant="stroke"
                            width="auto"
                            className="flex-1 justify-center"
                            onClick={() => setEditing(false)}
                        >
                            {t('cancel')}
                        </Button>
                        <Button
                            width="auto"
                            shadowSize="4"
                            className="flex-1 justify-center"
                            loading={save.isPending}
                            onClick={() => void commit()}
                            data-testid="couple-split-save"
                        >
                            {t('save')}
                        </Button>
                    </div>
                </div>
            )}
        </section>
    )
}

/**
 * Viajes planeados: a trip is a vaquita inside the couple's tribu, with the place as its name, a
 * goal and the month they leave. Once created it shows as a pot card with its progress and the
 * monthly amount that gets them there on time.
 */
export function CoupleTrips({ slug, state, currencies, meId, token }: Omit<Props, 'onAddTypical'>) {
    const t = useTranslations('room.couple')
    const locale = useLocale()
    const errorMessage = useErrorMessage()
    const createPot = useCreatePot(slug, token)
    const [open, setOpen] = useState(false)
    const [place, setPlace] = useState('')
    const [month, setMonth] = useState('')
    const [target, setTarget] = useState('')
    const [problem, setProblem] = useState<string | null>(null)
    const [first] = coupleMembers(state.members)
    const keeperId = meId ?? first?.id ?? ''

    const reset = () => {
        setOpen(false)
        setPlace('')
        setMonth('')
        setTarget('')
        setProblem(null)
    }

    const create = async () => {
        if (!place.trim() || !keeperId) return
        const decimals = decimalsOf(state.room.currency, currencies)
        const targetMinor = target.trim() ? parseAmountToMinor(target, decimals, locale) : undefined
        if (targetMinor === null) return setProblem(t('tripAmountInvalid'))
        // The trip's month, read as its first day at noon UTC so no time zone moves it to the month before.
        const dueDate = /^\d{4}-\d{2}$/.test(month) ? new Date(`${month}-01T12:00:00Z`).toISOString() : null
        try {
            await createPot.mutateAsync({
                name: t('tripName', { place: place.trim() }).slice(0, 80),
                keeperId,
                targetMinor,
                dueDate,
            })
            reset()
            toast.success(t('tripCreated'), { duration: TOAST_MS.actionable })
        } catch (error) {
            toast.error(errorMessage(error), { duration: TOAST_MS.actionable })
        }
    }

    if (!open)
        return (
            <button
                type="button"
                onClick={() => setOpen(true)}
                className="flex w-full items-center gap-3 rounded-sm border border-dashed border-n-1 bg-white/60 p-3 text-left"
                data-testid="couple-trip-start"
            >
                <Doodle name="plane" size={26} weight={1.8} className="shrink-0" />
                <span className="grid gap-0.5">
                    <span className="text-h8">{t('tripStart')}</span>
                    <span className="text-sm text-grey-1">{t('tripStartHint')}</span>
                </span>
            </button>
        )

    return (
        <section className="grid gap-3 rounded-sm border border-n-1 bg-white p-3" data-testid="couple-trip-form">
            <p className="text-h8">{t('tripFormTitle')}</p>
            <label className="grid gap-1">
                <span className="text-sm font-bold">{t('tripPlace')}</span>
                <BaseInput
                    value={place}
                    onChange={(event) => setPlace(event.target.value)}
                    placeholder={t('tripPlacePlaceholder')}
                    maxLength={60}
                    autoFocus
                    data-testid="couple-trip-place"
                />
            </label>
            <label className="grid gap-1">
                <span className="text-sm font-bold">{t('tripWhen')}</span>
                <BaseInput
                    type="month"
                    value={month}
                    onChange={(event) => setMonth(event.target.value)}
                    data-testid="couple-trip-month"
                />
            </label>
            <label className="grid gap-1">
                <span className="text-sm font-bold">{t('tripTarget', { currency: state.room.currency })}</span>
                <BaseInput
                    value={target}
                    onChange={(event) => setTarget(event.target.value)}
                    inputMode="decimal"
                    autoComplete="off"
                    maxLength={20}
                    data-testid="couple-trip-target"
                />
            </label>
            <p className="text-sm text-grey-1">{t('tripHint')}</p>
            {problem && (
                <p role="alert" className="text-sm font-bold text-error">
                    {problem}
                </p>
            )}
            <div className="flex gap-2">
                <Button variant="stroke" width="auto" className="flex-1 justify-center" onClick={reset}>
                    {t('cancel')}
                </Button>
                <Button
                    width="auto"
                    shadowSize="4"
                    className="flex-1 justify-center"
                    loading={createPot.isPending}
                    disabled={!place.trim()}
                    onClick={() => void create()}
                    data-testid="couple-trip-create"
                >
                    {t('tripCreate')}
                </Button>
            </div>
        </section>
    )
}

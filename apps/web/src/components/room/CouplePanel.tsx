'use client'

import { useMemo, useState } from 'react'
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
    nextTrip,
    type CoupleExpenseId,
} from '@/lib/couple'
import { useErrorMessage } from '@/lib/error-messages'
import { localMonthKey, monthSummary } from '@/lib/month-summary'
import { getExpenseSubject } from '@/lib/expense-category'
import { decimalsOf, parseAmountToMinor } from '@/lib/money'
import { useSaveCoupleSplit } from '@/lib/queries/couple'
import { useCreatePot } from '@/lib/queries/pots'
import { themeFor } from '@/lib/themes'
import { TOAST_MS } from '@/lib/toasts'
import {
    HeartSticker,
    PawSticker,
    PlaneSticker,
    RONDA_LIME,
    RONDA_ORANGE,
    RONDA_PINK,
    RONDA_TEAL,
    RONDA_VIOLET,
    RONDA_YELLOW,
} from './CoupleStickers'
import { MemberAvatar } from './MemberAvatar'
import { Money } from './Money'

interface Props {
    slug: string
    state: RoomState
    currencies: readonly CurrencyInfo[]
    meId?: string | null
    token?: string | null
    /** Open the new-expense form with one of the couple's typical expenses filled in. */
    onAddTypical: (id: CoupleExpenseId, monthly: boolean) => void
    /** Open the settle drawer. */
    onSettle: () => void
}

/**
 * The top of a couple's tribu: the two of them, what they spent together this month, whether they
 * are even, and their typical expenses one tap away. A couple shares a life, so the balance is one
 * quiet line in the hero rather than red and green debt cards and reminders. How they split is
 * `CoupleSplitCard`, lower down; the trips they save for are `CoupleTrips`.
 */
export function CouplePanel(props: Props) {
    return (
        <div className="mb-4 grid gap-4" data-testid="couple-panel">
            <CoupleHero state={props.state} currencies={props.currencies} onSettle={props.onSettle} />
            <TypicalExpenses onAddTypical={props.onAddTypical} />
        </div>
    )
}

/** The colours of the logo ring, one per typical expense, so the grid reads like the brand. */
const TYPICAL_COLORS = [
    RONDA_YELLOW,
    RONDA_LIME,
    RONDA_TEAL,
    RONDA_PINK,
    RONDA_ORANGE,
    RONDA_VIOLET,
    RONDA_ORANGE,
    RONDA_PINK,
]

/**
 * The two of them, side by side with a heart, and the next trip if they planned one. Decoration in
 * the Ronda style; the facts on it (names, the trip, when the tribu started) are all real.
 */
function CoupleHero({
    state,
    currencies,
    onSettle,
}: {
    state: RoomState
    currencies: readonly CurrencyInfo[]
    onSettle: () => void
}) {
    const t = useTranslations('room.couple')
    const locale = useLocale()
    const month = useMemo(() => monthSummary(state, localMonthKey(new Date())), [state])
    const [first, second] = coupleMembers(state.members)
    if (!first || !second) return null
    const nameOf = (id: string) => state.members.find((member) => member.id === id)?.name ?? ''
    const transfer = state.suggestedTransfers[0]
    const trip = nextTrip(state)
    const since = new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(
        new Date(state.room.createdAt)
    )
    return (
        <section
            className="card-ronda relative overflow-hidden p-4"
            style={{ backgroundColor: themeFor(state.room.theme).tint }}
            data-testid="couple-hero"
        >
            <PawSticker size={26} className="absolute right-3 top-3 rotate-12" />
            {!trip && state.expenses.length === 0 && (
                <PlaneSticker size={24} className="absolute bottom-3 right-4 -rotate-12 opacity-90" />
            )}
            <div className="flex items-center gap-3">
                <span className="flex items-center">
                    <MemberAvatar name={first.name} avatar={first.avatar} size={52} className="border-2" />
                    <HeartSticker size={30} className="z-10 -mx-2 -rotate-6" />
                    <MemberAvatar name={second.name} avatar={second.avatar} size={52} className="border-2" />
                </span>
                <span className="min-w-0 flex-1 pr-6">
                    <span className="block truncate font-display text-2xl leading-tight">
                        {first.name} <span className="text-[#FF7AC6]">&amp;</span> {second.name}
                    </span>
                    <span className="block text-sm text-grey-1">{t('heroSince', { since })}</span>
                </span>
            </div>
            {month.expenseCount > 0 && (
                <p className="mt-3 text-sm" data-testid="couple-month-total">
                    {t.rich('monthTogether', {
                        amount: () => (
                            <Money
                                minor={month.totalMinor}
                                currency={state.room.currency}
                                catalog={currencies}
                                className="font-bold"
                            />
                        ),
                    })}
                </p>
            )}
            {state.expenses.length > 0 && (
                <div
                    className="mt-2 flex items-center justify-between gap-3 rounded-sm border-2 border-[#141414] bg-white px-3 py-2"
                    data-testid="couple-balance"
                >
                    <p className="min-w-0 text-sm">
                        {transfer
                            ? t.rich('toEven', {
                                  from: nameOf(transfer.fromId),
                                  to: nameOf(transfer.toId),
                                  amount: () => (
                                      <Money
                                          minor={transfer.amountMinor}
                                          currency={state.room.currency}
                                          catalog={currencies}
                                          className="font-bold"
                                      />
                                  ),
                              })
                            : t('even')}
                    </p>
                    {transfer && (
                        <button
                            type="button"
                            onClick={onSettle}
                            className="shrink-0 rounded-full border border-n-1 bg-white px-3 py-1 text-sm font-bold"
                            data-testid="couple-even-up"
                        >
                            {t('evenUp')}
                        </button>
                    )}
                </div>
            )}
            {trip && (
                <p
                    className="mt-3 inline-flex max-w-full items-center gap-2 rounded-full border-2 border-[#141414] bg-white px-3 py-1 text-sm font-bold"
                    data-testid="couple-next-trip"
                >
                    <PlaneSticker size={18} />
                    <span className="truncate">
                        {trip.monthsAway === 0
                            ? t('heroTripThisMonth', { name: trip.pot.name })
                            : t('heroTrip', { name: trip.pot.name, months: trip.monthsAway })}
                    </span>
                </p>
            )}
        </section>
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
                {COUPLE_EXPENSES.map((preset, index) => (
                    <li key={preset.id}>
                        <button
                            type="button"
                            onClick={() => onAddTypical(preset.id, preset.monthly)}
                            data-testid={`couple-typical-${preset.id}`}
                            className="card-ronda flex h-full w-full flex-col items-center gap-1 px-1 py-2 text-center transition-transform active:translate-y-[2px]"
                        >
                            <span
                                className="flex size-10 items-center justify-center rounded-full border-2 border-[#141414]"
                                style={{ backgroundColor: TYPICAL_COLORS[index % TYPICAL_COLORS.length] }}
                            >
                                {preset.id === 'mascota' ? (
                                    <PawSticker size={24} />
                                ) : preset.id === 'regalos' ? (
                                    <HeartSticker size={24} />
                                ) : (
                                    <Doodle name={getExpenseSubject(preset.category).doodle} size={22} weight={2} />
                                )}
                            </span>
                            <span className="max-w-full truncate text-xs font-bold leading-tight">
                                {t(`expenses.${preset.id}`)}
                            </span>
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

export function CoupleSplitCard({ slug, state, token }: Pick<Props, 'slug' | 'state' | 'token'>) {
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
        <section className="card-ronda p-3" data-testid="couple-split">
            <div className="flex items-center gap-3">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-full border-2 border-[#141414] bg-white">
                    <HeartSticker size={26} />
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
export function CoupleTrips({ slug, state, currencies, meId, token }: Omit<Props, 'onAddTypical' | 'onSettle'>) {
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
                className="mb-4 flex w-full items-center gap-3 rounded-2xl border-2 border-dashed border-[#141414] bg-white/60 p-3 text-left"
                data-testid="couple-trip-start"
            >
                <PlaneSticker size={30} className="shrink-0 -rotate-6" />
                <span className="grid gap-0.5">
                    <span className="text-h8">{t('tripStart')}</span>
                    <span className="text-sm text-grey-1">{t('tripStartHint')}</span>
                </span>
            </button>
        )

    return (
        <section className="card-ronda mb-4 grid gap-3 p-3" data-testid="couple-trip-form">
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

'use client'

import { useMemo, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { BaseInput } from '@/components/ui/BaseInput'
import { Button } from '@/components/ui/Button'
import { CloseButton } from '@/components/ui/CloseButton'
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/Drawer'
import { DrawerBody } from '@/components/ui/DrawerLayout'
import { Icon } from '@/components/ui/Icon'
import type { ApiPot, CurrencyInfo, RoomState } from '@/lib/api-types'
import { cn } from '@/lib/cn'
import { useErrorMessage } from '@/lib/error-messages'
import { activeMembers } from '@/lib/members'
import { decimalsOf, formatAmountInput, parseAmountToMinor } from '@/lib/money'
import { potSummary } from '@/lib/pots'
import { useAddPotContribution, useRemovePotContribution, useUpdatePot } from '@/lib/queries/pots'
import { TOAST_MS } from '@/lib/toasts'
import { PotYieldCard, PotYieldLine } from './PotYield'
import { StoryShareButton } from './StoryShareButton'
import { Money } from './Money'

type Props = {
    slug: string
    state: RoomState
    currencies?: readonly CurrencyInfo[]
    meId?: string | null
    token?: string | null
}

const monthDate = (key: string) => {
    const [year, month] = key.split('-').map(Number)
    return new Date(year, month - 1, 1)
}

export function ProgressBar({ pct }: { pct: number }) {
    return (
        <span className="block h-3 overflow-hidden rounded-full border border-n-1 bg-white">
            <span
                className="block h-full rounded-full bg-primary-1 transition-[width]"
                style={{ width: `${Math.min(100, Math.max(pct, pct > 0 ? 3 : 0))}%` }}
            />
        </span>
    )
}

/** Chips to pick one person; the roster is short enough that a select would only hide it. */
export function MemberChips({
    members,
    value,
    onChange,
    testId,
}: {
    members: { id: string; name: string }[]
    value: string
    onChange: (id: string) => void
    testId: string
}) {
    return (
        <div className="flex flex-wrap gap-2" role="radiogroup" data-testid={testId}>
            {members.map((member) => (
                <button
                    key={member.id}
                    type="button"
                    role="radio"
                    aria-checked={value === member.id}
                    onClick={() => onChange(member.id)}
                    className={cn(
                        'rounded-full border border-n-1 px-3 py-1.5 text-sm font-bold',
                        value === member.id ? 'bg-n-1 text-white' : 'bg-white'
                    )}
                >
                    {member.name}
                </button>
            ))}
        </div>
    )
}

/**
 * A pot a tribu already had, as a card that opens it. New vaquitas are rooms of their own (see
 * `VaquitaRoomPanel`). The pot's money is in the keeper's own account, and every surface says so.
 */
export function VaquitaCard({ slug, state, currencies, meId, token }: Props) {
    const t = useTranslations('room.pot')
    const [openId, setOpenId] = useState<string | null>(null)
    const pots = (state.pots ?? []).filter((pot) => !pot.closedAt)
    const nameOf = (id: string) => state.members.find((member) => member.id === id)?.name ?? t('someone')
    const openPot = (state.pots ?? []).find((pot) => pot.id === openId) ?? null

    // Vaquitas are their own rooms now; a tribu only keeps showing pots it already had.
    if (pots.length === 0) return null

    return (
        <>
            {pots.map((pot) => {
                const summary = potSummary(pot, state)
                return (
                    <button
                        key={pot.id}
                        type="button"
                        onClick={() => setOpenId(pot.id)}
                        className="shadow-4 mb-4 flex w-full items-center gap-3 rounded-sm border border-n-1 bg-primary-3/40 p-3 text-left transition-transform active:translate-y-[2px]"
                        data-testid="pot-card"
                    >
                        <span className="flex size-10 shrink-0 items-center justify-center rounded-full border border-n-1 bg-white">
                            <Icon name="hand-coins" size={20} />
                        </span>
                        <span className="grid min-w-0 flex-1 gap-1">
                            <span className="flex items-baseline justify-between gap-2">
                                <span className="truncate text-h8">{pot.name}</span>
                                <Money
                                    minor={summary.heldMinor}
                                    currency={state.room.currency}
                                    catalog={currencies}
                                    className="shrink-0 font-bold"
                                />
                            </span>
                            {summary.progressPct !== null && <ProgressBar pct={summary.progressPct} />}
                            <span className="block truncate text-sm text-grey-1">
                                {t('cardKeeper', { name: nameOf(pot.keeperId) })}
                            </span>
                            <PotYieldLine pot={pot} state={state} currencies={currencies} />
                        </span>
                        <Icon name="chevron-right" size={18} className="shrink-0 text-grey-1" />
                    </button>
                )
            })}
            <PotDrawer
                pot={openPot}
                onClose={() => setOpenId(null)}
                slug={slug}
                state={state}
                currencies={currencies}
                meId={meId}
                token={token}
            />
        </>
    )
}

function PotDrawer({ pot, onClose, ...props }: Props & { pot: ApiPot | null; onClose: () => void }) {
    const t = useTranslations('room.pot')
    if (!pot) return <Drawer open={false} onOpenChange={() => undefined} />
    return (
        <Drawer open onOpenChange={(next) => !next && onClose()}>
            <DrawerContent data-testid="pot-drawer">
                <DrawerHeader className="flex flex-row items-end justify-between">
                    <DrawerTitle className="truncate text-h5">{pot.name}</DrawerTitle>
                    <CloseButton onClick={onClose} label={t('close')} />
                </DrawerHeader>
                <DrawerBody>
                    <PotDetails pot={pot} onClosed={onClose} {...props} />
                </DrawerBody>
            </DrawerContent>
        </Drawer>
    )
}

/**
 * Everything about one vaquita: what is in it, who keeps it, the goal, this month's quota, the
 * contributions and what it paid. Shown in a sheet inside a tribu, and as the page itself in a
 * room that is a vaquita.
 */
export function PotDetails({
    pot,
    onClosed,
    onStartAnother,
    slug,
    state,
    currencies,
    meId,
    token,
}: Props & { pot: ApiPot; onClosed?: () => void; onStartAnother?: () => void }) {
    const t = useTranslations('room.pot')
    const locale = useLocale()
    const errorMessage = useErrorMessage()
    const addContribution = useAddPotContribution(slug, token)
    const removeContribution = useRemovePotContribution(slug, token)
    const updatePot = useUpdatePot(slug, token)
    const decimals = decimalsOf(state.room.currency, currencies)
    const roster = activeMembers(state.members)
    const [putting, setPutting] = useState(false)
    const [who, setWho] = useState(meId ?? '')
    const [amount, setAmount] = useState('')
    const [problem, setProblem] = useState<string | null>(null)
    const [confirmClose, setConfirmClose] = useState(false)
    const summary = useMemo(() => potSummary(pot, state), [pot, state])

    const nameOf = (id: string) => state.members.find((member) => member.id === id)?.name ?? t('someone')
    const keeper = nameOf(pot.keeperId)
    const money = (minor: string, className?: string) => (
        <Money minor={minor} currency={state.room.currency} catalog={currencies} className={className} />
    )
    const monthLabel = (key: string) =>
        new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(monthDate(key))
    const held = BigInt(summary.heldMinor)
    const potExpenses = state.expenses.filter((expense) => summary.expenseIds.includes(expense.id))
    const closed = !!pot.closedAt

    const quotaFor = (memberId: string) =>
        summary.quotaMissing.find((line) => line.memberId === memberId)?.amountMinor ?? null

    const startPutting = (memberId: string) => {
        setWho(memberId)
        const missing = quotaFor(memberId)
        setAmount(missing ? formatAmountInput(missing, decimals, locale) : '')
        setProblem(null)
        setPutting(true)
    }

    const put = async () => {
        const parsed = parseAmountToMinor(amount, decimals, locale)
        if (!who) return setProblem(t('whoMissing'))
        if (parsed === null || BigInt(parsed) <= 0n) return setProblem(t('amountInvalid'))
        try {
            await addContribution.mutateAsync({ potId: pot.id, memberId: who, amountMinor: parsed })
            setPutting(false)
            setAmount('')
            toast(t('putDone'), { duration: TOAST_MS.actionable })
        } catch (error) {
            setProblem(errorMessage(error))
        }
    }

    const remove = async (contributionId: string) => {
        try {
            await removeContribution.mutateAsync({ potId: pot.id, contributionId })
            toast(t('removed'), { duration: TOAST_MS.actionable })
        } catch (error) {
            toast.error(errorMessage(error), { duration: TOAST_MS.actionable })
        }
    }

    const close = async () => {
        try {
            await updatePot.mutateAsync({ potId: pot.id, closed: true })
            setConfirmClose(false)
            toast(t('closedToast'), { duration: TOAST_MS.actionable })
            onClosed?.()
        } catch (error) {
            toast.error(errorMessage(error), { duration: TOAST_MS.actionable })
        }
    }

    return (
        <div className="grid gap-5">
            <div className="rounded-sm border border-n-1 bg-primary-3/40 p-4 text-center">
                <p className="text-sm text-grey-1">{t('held')}</p>
                {money(held < 0n ? '0' : summary.heldMinor, 'block text-h3')}
                {summary.progressPct !== null && pot.targetMinor && (
                    <div className="mt-3 grid gap-1 text-left">
                        <ProgressBar pct={summary.progressPct} />
                        <p className="flex justify-between gap-2 text-sm">
                            <span>
                                {t.rich('progress', {
                                    pct: summary.progressPct,
                                    amount: () => money(pot.targetMinor!, 'font-bold'),
                                })}
                            </span>
                            {summary.missingMinor !== '0' ? (
                                <span className="text-grey-1">
                                    {t.rich('missing', { amount: () => money(summary.missingMinor!) })}
                                </span>
                            ) : (
                                <span className="font-bold">{t('reached')}</span>
                            )}
                        </p>
                    </div>
                )}
                {held < 0n && (
                    <p className="mt-2 text-sm text-grey-1">
                        {t.rich('fronted', {
                            name: keeper,
                            amount: () => money((-held).toString(), 'font-bold text-n-1'),
                        })}
                    </p>
                )}
            </div>

            <div className="flex items-start gap-3 rounded-sm border-2 border-n-1 bg-white p-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-secondary-1/40">
                    <Icon name="wallet" size={18} />
                </span>
                <span className="grid gap-0.5 text-sm">
                    <span className="text-h10 font-bold uppercase tracking-wide text-grey-1">{t('keeperBadge')}</span>
                    <span className="font-bold">{t('keeperLine', { name: keeper })}</span>
                    <span className="text-grey-1">{t('keeperNote', { name: keeper })}</span>
                </span>
            </div>

            <PotYieldCard pot={pot} state={state} currencies={currencies} slug={slug} token={token} keeper={keeper} />

            {!closed && (summary.projectedMonth || summary.suggestedQuotaMinor) && (
                <div className="flex items-start gap-2 text-sm" data-testid="pot-forecast">
                    <Icon name="sparkles" size={16} className="mt-0.5 shrink-0" />
                    <span className="grid gap-1">
                        {summary.projectedMonth && (
                            <span>{t('projected', { month: monthLabel(summary.projectedMonth) })}</span>
                        )}
                        {summary.suggestedQuotaMinor && pot.dueDate && (
                            <span>
                                {t.rich('suggested', {
                                    month: monthLabel(pot.dueDate.slice(0, 7)),
                                    amount: () => money(summary.suggestedQuotaMinor!, 'font-bold'),
                                })}
                            </span>
                        )}
                    </span>
                </div>
            )}

            {!closed && pot.quotaMinor && (
                <section className="grid gap-2">
                    <h3 className="text-h8 uppercase tracking-wide text-grey-1">
                        {t.rich('quotaTitle', { amount: () => money(pot.quotaMinor!) })}
                    </h3>
                    {summary.quotaMissing.length === 0 ? (
                        <p className="text-sm">{t('quotaAllIn')}</p>
                    ) : (
                        <ul className="grid gap-1">
                            {summary.quotaMissing.map((line) => (
                                <li key={line.memberId}>
                                    <button
                                        type="button"
                                        onClick={() => startPutting(line.memberId)}
                                        className="flex w-full items-center justify-between gap-2 rounded-sm border border-n-1 bg-white px-3 py-2 text-left text-sm"
                                    >
                                        <span className="truncate font-bold">{nameOf(line.memberId)}</span>
                                        <span className="shrink-0 text-grey-1">
                                            {t.rich('quotaMissing', {
                                                amount: () => money(line.amountMinor),
                                            })}
                                        </span>
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}
                </section>
            )}

            {!closed &&
                (putting ? (
                    <form
                        className="grid gap-3 rounded-sm border border-n-1 bg-white p-3"
                        onSubmit={(event) => {
                            event.preventDefault()
                            void put()
                        }}
                        data-testid="pot-put-form"
                    >
                        <span className="text-sm font-bold">{t('putWho')}</span>
                        <MemberChips members={roster} value={who} onChange={setWho} testId="pot-put-who" />
                        <label className="grid gap-1">
                            <span className="text-sm font-bold">{t('putAmount')}</span>
                            <BaseInput
                                value={amount}
                                onChange={(event) => setAmount(event.target.value)}
                                onBlur={() => {
                                    const parsed = parseAmountToMinor(amount, decimals, locale)
                                    if (parsed !== null) setAmount(formatAmountInput(parsed, decimals, locale))
                                }}
                                inputMode="decimal"
                                autoComplete="off"
                                maxLength={20}
                                variant="lg"
                                className="text-center tabular-nums"
                                data-testid="pot-put-amount"
                            />
                        </label>
                        {who && who !== pot.keeperId && (
                            <p className="text-sm text-grey-1">{t('putNote', { name: nameOf(who), keeper })}</p>
                        )}
                        {problem && (
                            <p role="alert" className="text-sm font-bold text-error">
                                {problem}
                            </p>
                        )}
                        <div className="flex gap-2">
                            <Button
                                type="button"
                                variant="stroke"
                                width="auto"
                                className="flex-1 justify-center"
                                onClick={() => setPutting(false)}
                            >
                                {t('cancel')}
                            </Button>
                            <Button
                                type="submit"
                                width="auto"
                                shadowSize="4"
                                className="flex-1 justify-center"
                                loading={addContribution.isPending}
                                data-testid="pot-put-submit"
                            >
                                {t('putSubmit')}
                            </Button>
                        </div>
                    </form>
                ) : (
                    <Button shadowSize="4" icon="plus" onClick={() => startPutting(meId ?? '')} data-testid="pot-put">
                        {t('put')}
                    </Button>
                ))}

            {summary.byMember.length > 0 && (
                <section className="grid gap-2">
                    <h3 className="text-h8 uppercase tracking-wide text-grey-1">{t('byMemberTitle')}</h3>
                    <ul className="grid gap-1">
                        {summary.byMember.map((line) => (
                            <li key={line.memberId} className="flex justify-between gap-2 text-sm">
                                <span className="truncate">{nameOf(line.memberId)}</span>
                                {money(line.amountMinor, 'shrink-0 font-bold')}
                            </li>
                        ))}
                    </ul>
                </section>
            )}

            <section className="grid gap-2">
                <h3 className="text-h8 uppercase tracking-wide text-grey-1">{t('spentTitle')}</h3>
                {potExpenses.length === 0 ? (
                    <p className="text-sm text-grey-1">{t('spentEmpty', { name: keeper })}</p>
                ) : (
                    <ul className="grid gap-1">
                        {potExpenses.map((expense) => (
                            <li key={expense.id} className="flex justify-between gap-2 text-sm">
                                <span className="truncate">{expense.description || t('unnamed')}</span>
                                {money(expense.baseAmountMinor, 'shrink-0 font-bold')}
                            </li>
                        ))}
                    </ul>
                )}
            </section>

            {pot.contributions.length > 0 && (
                <section className="grid gap-2">
                    <h3 className="text-h8 uppercase tracking-wide text-grey-1">{t('historyTitle')}</h3>
                    <ul className="grid gap-1">
                        {[...pot.contributions].reverse().map((contribution) => (
                            <li
                                key={contribution.id}
                                className="flex items-center justify-between gap-2 rounded-sm border border-n-1 bg-white px-3 py-2 text-sm"
                            >
                                <span className="min-w-0 truncate">
                                    <span className="font-bold">{nameOf(contribution.memberId)}</span>{' '}
                                    {contribution.reason && (
                                        <span className="mr-1 inline-block rounded-full bg-primary-3 px-2 py-0.5 text-h10 font-bold uppercase tracking-wide">
                                            {t('reasonRoundup')}
                                        </span>
                                    )}
                                    <span className="text-grey-1">
                                        {new Intl.DateTimeFormat(locale, {
                                            day: 'numeric',
                                            month: 'short',
                                        }).format(new Date(contribution.createdAt))}
                                    </span>
                                </span>
                                <span className="flex shrink-0 items-center gap-2">
                                    {money(contribution.amountMinor, 'font-bold')}
                                    {!closed && (
                                        <button
                                            type="button"
                                            aria-label={t('remove')}
                                            onClick={() => void remove(contribution.id)}
                                            className="flex size-7 items-center justify-center rounded-full text-grey-1"
                                        >
                                            <Icon name="x" size={14} />
                                        </button>
                                    )}
                                </span>
                            </li>
                        ))}
                    </ul>
                </section>
            )}

            {!closed &&
                (confirmClose ? (
                    <div className="grid gap-2 rounded-sm border border-n-1 bg-white p-3 text-sm">
                        <p>{t('closeHint')}</p>
                        <div className="flex gap-2">
                            <Button
                                variant="stroke"
                                width="auto"
                                className="flex-1 justify-center"
                                onClick={() => setConfirmClose(false)}
                            >
                                {t('cancel')}
                            </Button>
                            <Button
                                width="auto"
                                shadowSize="4"
                                className="flex-1 justify-center"
                                loading={updatePot.isPending}
                                onClick={() => void close()}
                                data-testid="pot-close-confirm"
                            >
                                {t('closeConfirm')}
                            </Button>
                        </div>
                    </div>
                ) : (
                    <button
                        type="button"
                        onClick={() => setConfirmClose(true)}
                        className="text-center text-sm font-bold underline"
                    >
                        {t('closePot')}
                    </button>
                ))}
            {closed && onStartAnother && (
                <button type="button" onClick={onStartAnother} className="text-center text-sm font-bold underline">
                    {t('startAnother')}
                </button>
            )}
        </div>
    )
}

/**
 * The page of a room that is a vaquita: its pot, open on the page rather than in a sheet. A
 * closed pot stays readable; the expenses and payments below it are the room's usual list.
 */
export function VaquitaRoomPanel(props: Props) {
    const t = useTranslations('room.pot')
    const router = useRouter()
    const pots = props.state.pots ?? []
    const pot = pots.find((candidate) => !candidate.closedAt) ?? pots.at(-1) ?? null
    if (!pot) return null
    return (
        <section className="mb-6 grid gap-3" data-testid="vaquita-room">
            {pot.closedAt && <p className="text-sm font-bold text-grey-1">{t('closedLabel')}</p>}
            <PotDetails pot={pot} onStartAnother={() => router.push('/new?tipo=vaquita')} {...props} />
            {(pot.closedAt || potSummary(pot, props.state).missingMinor === '0') && (
                <StoryShareButton slug={props.slug} />
            )}
        </section>
    )
}

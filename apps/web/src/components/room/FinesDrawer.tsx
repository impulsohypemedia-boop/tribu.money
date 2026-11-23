'use client'

import { useEffect, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { BaseInput } from '@/components/ui/BaseInput'
import { Button } from '@/components/ui/Button'
import { CloseButton } from '@/components/ui/CloseButton'
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/Drawer'
import { DrawerBody } from '@/components/ui/DrawerLayout'
import { useInLemon } from '@/components/lemon/LemonProvider'
import type { ApiFine } from '@/lib/api-types'
import { cn } from '@/lib/cn'
import { useErrorMessage } from '@/lib/error-messages'
import { fineVoterIds } from '@/lib/fines'
import { payKeeperWithLemon } from '@/lib/lemon/pay-keeper'
import { activeMembers } from '@/lib/members'
import { decimalsOf, formatAmountInput, parseAmountToMinor } from '@/lib/money'
import { openPots } from '@/lib/pots'
import { useActOnFine, useProposeFine } from '@/lib/queries/pots'
import { defaultRoundUpUnit, unitToMinor } from '@/lib/roundup'
import { TOAST_MS } from '@/lib/toasts'
import { useFeedback } from '@/lib/use-settings'
import { Money } from './Money'
import { TribePotSetup, type GameProps } from './TribeGames'
import { MemberChips } from './Vaquita'

const REASON_KEYS = ['late', 'noShow', 'lastMinute'] as const

export function FinesDrawer({ open, onClose, ...props }: GameProps & { open: boolean; onClose: () => void }) {
    const { slug, state, currencies, meId, token } = props
    const t = useTranslations('room.games.fines')
    const locale = useLocale()
    const errorMessage = useErrorMessage()
    const feedback = useFeedback()
    const inLemon = useInLemon()
    const propose = useProposeFine(slug, token)
    const act = useActOnFine(slug, token)
    const decimals = decimalsOf(state.room.currency, currencies)
    const roster = activeMembers(state.members)
    const pot = openPots(state)[0] ?? null
    const keeper = pot ? state.members.find((member) => member.id === pot.keeperId) : null

    const defaultAmount = () =>
        formatAmountInput(unitToMinor(defaultRoundUpUnit(state.room.currency), decimals).toString(), decimals, locale)
    const [creating, setCreating] = useState(false)
    const [who, setWho] = useState('')
    const [reason, setReason] = useState('')
    const [amount, setAmount] = useState('')
    const [problem, setProblem] = useState<string | null>(null)
    const [payingId, setPayingId] = useState<string | null>(null)

    const fines = state.fines ?? []
    const open_ = fines.filter((fine) => fine.status === 'voting' || fine.status === 'approved')
    const closed = fines.filter((fine) => fine.status === 'paid' || fine.status === 'rejected').slice(0, 10)

    useEffect(() => {
        if (!open) return
        setCreating(false)
        setWho('')
        setReason(t(`reasons.${REASON_KEYS[0]}`))
        setAmount(defaultAmount())
        setProblem(null)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open])

    const nameOf = (id: string) =>
        id === meId ? t('you') : (state.members.find((member) => member.id === id)?.name ?? t('someone'))
    const money = (minor: string, className = 'font-bold') => (
        <Money minor={minor} currency={state.room.currency} catalog={currencies} className={className} />
    )

    const submit = async () => {
        setProblem(null)
        const parsed = parseAmountToMinor(amount, decimals, locale)
        if (!who) return setProblem(t('whoMissing'))
        if (!reason.trim()) return setProblem(t('reasonMissing'))
        if (parsed === null || BigInt(parsed) <= 0n) return setProblem(t('amountInvalid'))
        try {
            await propose.mutateAsync({ memberId: who, reason: reason.trim(), amountMinor: parsed })
            feedback('blip')
            setCreating(false)
            toast(t('proposed'), { duration: TOAST_MS.actionable })
        } catch (error) {
            setProblem(errorMessage(error))
        }
    }

    const vote = async (fine: ApiFine, yes: boolean) => {
        try {
            await act.mutateAsync({ fineId: fine.id, action: 'vote', vote: yes })
        } catch (error) {
            toast.error(errorMessage(error), { duration: TOAST_MS.actionable })
        }
    }

    const pay = async (fine: ApiFine) => {
        if (payingId) return
        setPayingId(fine.id)
        try {
            // Inside Lemon the fined person sends the money to the keeper for real first.
            if (inLemon && fine.memberId === meId && keeper?.walletAddress && keeper.id !== meId) {
                const sent = await payKeeperWithLemon({
                    slug,
                    amountMinor: fine.amountMinor,
                    keeperWallet: keeper.walletAddress,
                    stablecoin: 'USDC',
                    title: t('lemonTitle', { name: keeper.name }),
                })
                if (sent.status === 'cancelled') return
                if (sent.status === 'failed') throw new Error(t('lemonFailed'))
            }
            await act.mutateAsync({ fineId: fine.id, action: 'pay' })
            feedback('thunk')
            toast(t('paidToast'), { duration: TOAST_MS.actionable })
        } catch (error) {
            toast.error(error instanceof Error && !('code' in error) ? error.message : errorMessage(error), {
                duration: TOAST_MS.actionable,
            })
        } finally {
            setPayingId(null)
        }
    }

    const cancel = async (fine: ApiFine) => {
        try {
            await act.mutateAsync({ fineId: fine.id, action: 'cancel' })
        } catch (error) {
            toast.error(errorMessage(error), { duration: TOAST_MS.actionable })
        }
    }

    return (
        <Drawer open={open} onOpenChange={(next) => !next && onClose()} repositionInputs={false}>
            <DrawerContent data-testid="fines-drawer">
                <DrawerHeader className="flex flex-row items-end justify-between">
                    <DrawerTitle className="text-h5">{t('title')}</DrawerTitle>
                    <CloseButton onClick={onClose} label={t('close')} />
                </DrawerHeader>
                <DrawerBody>
                    <div className="grid gap-4">
                        <p className="text-sm text-grey-1">
                            {pot ? t('intro', { pot: pot.name, keeper: keeper?.name ?? '' }) : t('needsPot')}
                        </p>
                        {!pot && <TribePotSetup {...props} />}
                        {!meId && <p className="text-sm font-bold">{t('pickYourself')}</p>}

                        {open_.length > 0 && (
                            <ul className="grid gap-2">
                                {open_.map((fine) => {
                                    const voters = fineVoterIds(state.members, fine.memberId)
                                    const yes = voters.filter((id) => fine.votes[id] === true).length
                                    const canVote =
                                        fine.status === 'voting' &&
                                        !!meId &&
                                        voters.includes(meId) &&
                                        fine.votes[meId] === undefined
                                    const canPay =
                                        fine.status === 'approved' &&
                                        !!meId &&
                                        (meId === fine.memberId || meId === pot?.keeperId)
                                    return (
                                        <li
                                            key={fine.id}
                                            className="grid gap-2 rounded-sm border border-n-1 bg-white p-3"
                                            data-testid="fine-card"
                                        >
                                            <div className="flex items-start justify-between gap-2">
                                                <span className="min-w-0">
                                                    <span className="block text-h8">
                                                        {t('cardTitle', { name: nameOf(fine.memberId) })}
                                                    </span>
                                                    <span className="block text-sm text-grey-1">{fine.reason}</span>
                                                </span>
                                                {money(fine.amountMinor, 'shrink-0 font-bold')}
                                            </div>
                                            <p className="text-sm">
                                                {fine.status === 'voting'
                                                    ? t('votes', { yes, total: voters.length })
                                                    : t('approved', { pot: pot?.name ?? '' })}
                                            </p>
                                            <div className="flex flex-wrap items-center gap-2">
                                                {canVote && (
                                                    <>
                                                        <Button
                                                            size="small"
                                                            width="auto"
                                                            shadowSize="4"
                                                            onClick={() => void vote(fine, true)}
                                                            data-testid="fine-vote-yes"
                                                        >
                                                            {t('voteYes')}
                                                        </Button>
                                                        <Button
                                                            size="small"
                                                            width="auto"
                                                            variant="stroke"
                                                            onClick={() => void vote(fine, false)}
                                                            data-testid="fine-vote-no"
                                                        >
                                                            {t('voteNo')}
                                                        </Button>
                                                    </>
                                                )}
                                                {canPay && (
                                                    <Button
                                                        size="small"
                                                        width="auto"
                                                        shadowSize="4"
                                                        loading={payingId === fine.id}
                                                        onClick={() => void pay(fine)}
                                                        data-testid="fine-pay"
                                                    >
                                                        {meId === fine.memberId ? t('pay') : t('markPaid')}
                                                    </Button>
                                                )}
                                                {meId === fine.proposedById && (
                                                    <button
                                                        type="button"
                                                        onClick={() => void cancel(fine)}
                                                        className="px-2 text-sm font-bold underline"
                                                    >
                                                        {t('drop')}
                                                    </button>
                                                )}
                                            </div>
                                        </li>
                                    )
                                })}
                            </ul>
                        )}

                        {pot && meId && creating && (
                            <form
                                className="grid gap-3 rounded-sm border border-n-1 bg-primary-3/40 p-3"
                                onSubmit={(event) => {
                                    event.preventDefault()
                                    void submit()
                                }}
                                data-testid="fine-form"
                            >
                                <span className="text-sm font-bold">{t('who')}</span>
                                <MemberChips members={roster} value={who} onChange={setWho} testId="fine-who" />
                                <span className="text-sm font-bold">{t('why')}</span>
                                <div className="flex flex-wrap gap-2">
                                    {REASON_KEYS.map((key) => {
                                        const label = t(`reasons.${key}`)
                                        return (
                                            <button
                                                key={key}
                                                type="button"
                                                onClick={() => setReason(label)}
                                                className={cn(
                                                    'rounded-full border border-n-1 px-3 py-1.5 text-sm font-bold',
                                                    reason === label ? 'bg-n-1 text-white' : 'bg-white'
                                                )}
                                            >
                                                {label}
                                            </button>
                                        )
                                    })}
                                </div>
                                <BaseInput
                                    value={reason}
                                    onChange={(event) => setReason(event.target.value)}
                                    maxLength={80}
                                    aria-label={t('why')}
                                />
                                <label className="grid gap-1">
                                    <span className="text-sm font-bold">{t('amount')}</span>
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
                                        className="tabular-nums"
                                        data-testid="fine-amount"
                                    />
                                </label>
                                <p className="text-xs text-grey-1">{t('howItWorks')}</p>
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
                                        onClick={() => setCreating(false)}
                                    >
                                        {t('cancel')}
                                    </Button>
                                    <Button
                                        type="submit"
                                        width="auto"
                                        shadowSize="4"
                                        className="flex-1 justify-center"
                                        loading={propose.isPending}
                                        data-testid="fine-submit"
                                    >
                                        {t('propose')}
                                    </Button>
                                </div>
                            </form>
                        )}
                        {pot && meId && !creating && (
                            <Button
                                variant="stroke"
                                icon="plus"
                                onClick={() => setCreating(true)}
                                data-testid="fine-new"
                            >
                                {t('new')}
                            </Button>
                        )}

                        {closed.length > 0 && (
                            <section className="grid gap-2">
                                <h3 className="text-h8 uppercase tracking-wide text-grey-1">{t('historyTitle')}</h3>
                                <ul className="grid gap-1">
                                    {closed.map((fine) => (
                                        <li key={fine.id} className="flex justify-between gap-2 text-sm">
                                            <span className="min-w-0 truncate">
                                                <span className="font-bold">{nameOf(fine.memberId)}</span>{' '}
                                                <span className="text-grey-1">
                                                    {fine.reason} ·{' '}
                                                    {fine.status === 'paid' ? t('statusPaid') : t('statusRejected')}
                                                </span>
                                            </span>
                                            {money(fine.amountMinor, 'shrink-0 font-bold')}
                                        </li>
                                    ))}
                                </ul>
                            </section>
                        )}
                    </div>
                </DrawerBody>
            </DrawerContent>
        </Drawer>
    )
}

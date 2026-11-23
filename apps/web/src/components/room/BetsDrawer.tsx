'use client'

import { useEffect, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { BaseInput } from '@/components/ui/BaseInput'
import { Button } from '@/components/ui/Button'
import { CloseButton } from '@/components/ui/CloseButton'
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/Drawer'
import { DrawerBody } from '@/components/ui/DrawerLayout'
import type { ApiBet } from '@/lib/api-types'
import { betActions, betLoser, type BetAction } from '@/lib/bets'
import { useErrorMessage } from '@/lib/error-messages'
import { activeMembers } from '@/lib/members'
import { decimalsOf, formatAmountInput, parseAmountToMinor } from '@/lib/money'
import { useActOnBet, useCreateBet } from '@/lib/queries/pots'
import { TOAST_MS } from '@/lib/toasts'
import { useFeedback } from '@/lib/use-settings'
import { Money } from './Money'
import { MemberChips } from './Vaquita'
import type { GameProps } from './TribeGames'

const ACTIVE: ApiBet['status'][] = ['proposed', 'accepted', 'claimed']

export function BetsDrawer({
    open,
    onClose,
    slug,
    state,
    currencies,
    meId,
    token,
}: GameProps & { open: boolean; onClose: () => void }) {
    const t = useTranslations('room.games.bets')
    const locale = useLocale()
    const errorMessage = useErrorMessage()
    const feedback = useFeedback()
    const createBet = useCreateBet(slug, token)
    const act = useActOnBet(slug, token)
    const decimals = decimalsOf(state.room.currency, currencies)
    const others = activeMembers(state.members).filter((member) => member.id !== meId)

    const [creating, setCreating] = useState(false)
    const [title, setTitle] = useState('')
    const [rivalId, setRivalId] = useState('')
    const [amount, setAmount] = useState('')
    const [problem, setProblem] = useState<string | null>(null)

    const bets = state.bets ?? []
    const active = bets.filter((bet) => ACTIVE.includes(bet.status))
    const finished = bets.filter((bet) => bet.status === 'resolved').slice(0, 10)

    useEffect(() => {
        if (!open) return
        setCreating(active.length === 0)
        setTitle('')
        setRivalId('')
        setAmount('')
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
        if (!title.trim()) return setProblem(t('titleMissing'))
        if (!rivalId) return setProblem(t('rivalMissing'))
        if (parsed === null || BigInt(parsed) <= 0n) return setProblem(t('amountInvalid'))
        try {
            await createBet.mutateAsync({ title: title.trim(), amountMinor: parsed, rivalId })
            feedback('blip')
            setCreating(false)
            toast(t('created', { name: nameOf(rivalId) }), { duration: TOAST_MS.actionable })
        } catch (error) {
            setProblem(errorMessage(error))
        }
    }

    const run = async (bet: ApiBet, action: BetAction, winnerId?: string) => {
        try {
            await act.mutateAsync({ betId: bet.id, action, winnerId })
            if (action === 'confirm') {
                feedback('thunk')
                toast(t('resolvedToast'), { duration: TOAST_MS.actionable })
            }
        } catch (error) {
            toast.error(errorMessage(error), { duration: TOAST_MS.actionable })
        }
    }

    const statusLine = (bet: ApiBet) => {
        switch (bet.status) {
            case 'proposed':
                return bet.rivalId === meId
                    ? t('statusProposedYou', { name: nameOf(bet.proposerId) })
                    : t('statusProposed', { name: nameOf(bet.rivalId) })
            case 'accepted':
                return t('statusAccepted')
            case 'claimed':
                return t('statusClaimed', { name: nameOf(bet.claimedById!), winner: nameOf(bet.claimedWinnerId!) })
            default:
                return ''
        }
    }

    return (
        <Drawer open={open} onOpenChange={(next) => !next && onClose()} repositionInputs={false}>
            <DrawerContent data-testid="bets-drawer">
                <DrawerHeader className="flex flex-row items-end justify-between">
                    <DrawerTitle className="text-h5">{t('title')}</DrawerTitle>
                    <CloseButton onClick={onClose} label={t('close')} />
                </DrawerHeader>
                <DrawerBody>
                    <div className="grid gap-4">
                        {!meId && <p className="text-sm font-bold">{t('pickYourself')}</p>}

                        {active.length > 0 && (
                            <ul className="grid gap-2">
                                {active.map((bet) => {
                                    const actions = betActions(bet, meId ?? null)
                                    const busy = act.isPending && act.variables?.betId === bet.id
                                    return (
                                        <li
                                            key={bet.id}
                                            className="grid gap-2 rounded-sm border border-n-1 bg-white p-3"
                                            data-testid="bet-card"
                                        >
                                            <div className="flex items-start justify-between gap-2">
                                                <span className="min-w-0">
                                                    <span className="block text-h8">{bet.title}</span>
                                                    <span className="block text-sm text-grey-1">
                                                        {t('between', {
                                                            a: nameOf(bet.proposerId),
                                                            b: nameOf(bet.rivalId),
                                                        })}
                                                    </span>
                                                </span>
                                                {money(bet.amountMinor, 'shrink-0 font-bold')}
                                            </div>
                                            <p className="text-sm">{statusLine(bet)}</p>
                                            {actions.length > 0 && (
                                                <div className="flex flex-wrap gap-2">
                                                    {actions.includes('accept') && (
                                                        <Button
                                                            size="small"
                                                            width="auto"
                                                            shadowSize="4"
                                                            loading={busy}
                                                            onClick={() => void run(bet, 'accept')}
                                                            data-testid="bet-accept"
                                                        >
                                                            {t('accept')}
                                                        </Button>
                                                    )}
                                                    {actions.includes('claim') &&
                                                        [bet.proposerId, bet.rivalId].map((winnerId) => (
                                                            <Button
                                                                key={winnerId}
                                                                size="small"
                                                                width="auto"
                                                                variant="stroke"
                                                                loading={busy}
                                                                onClick={() => void run(bet, 'claim', winnerId)}
                                                                data-testid="bet-claim"
                                                            >
                                                                {winnerId === meId
                                                                    ? t('iWon')
                                                                    : t('theyWon', { name: nameOf(winnerId) })}
                                                            </Button>
                                                        ))}
                                                    {actions.includes('confirm') && (
                                                        <>
                                                            <Button
                                                                size="small"
                                                                width="auto"
                                                                shadowSize="4"
                                                                loading={busy}
                                                                onClick={() => void run(bet, 'confirm')}
                                                                data-testid="bet-confirm"
                                                            >
                                                                {t('confirm')}
                                                            </Button>
                                                            <Button
                                                                size="small"
                                                                width="auto"
                                                                variant="stroke"
                                                                loading={busy}
                                                                onClick={() => void run(bet, 'dispute')}
                                                            >
                                                                {t('dispute')}
                                                            </Button>
                                                        </>
                                                    )}
                                                    {actions.includes('cancel') && (
                                                        <button
                                                            type="button"
                                                            onClick={() => void run(bet, 'cancel')}
                                                            className="px-2 text-sm font-bold underline"
                                                        >
                                                            {t('cancelBet')}
                                                        </button>
                                                    )}
                                                </div>
                                            )}
                                        </li>
                                    )
                                })}
                            </ul>
                        )}

                        {meId && others.length > 0 && creating ? (
                            <form
                                className="grid gap-3 rounded-sm border border-n-1 bg-primary-3/40 p-3"
                                onSubmit={(event) => {
                                    event.preventDefault()
                                    void submit()
                                }}
                                data-testid="bet-form"
                            >
                                <label className="grid gap-1">
                                    <span className="text-sm font-bold">{t('what')}</span>
                                    <BaseInput
                                        value={title}
                                        onChange={(event) => setTitle(event.target.value)}
                                        placeholder={t('whatPlaceholder')}
                                        maxLength={80}
                                        data-testid="bet-title"
                                    />
                                </label>
                                <span className="text-sm font-bold">{t('with')}</span>
                                <MemberChips
                                    members={others}
                                    value={rivalId}
                                    onChange={setRivalId}
                                    testId="bet-rival"
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
                                        data-testid="bet-amount"
                                    />
                                </label>
                                <p className="text-xs text-grey-1">{t('howItWorks')}</p>
                                {problem && (
                                    <p role="alert" className="text-sm font-bold text-error">
                                        {problem}
                                    </p>
                                )}
                                <Button
                                    type="submit"
                                    shadowSize="4"
                                    loading={createBet.isPending}
                                    data-testid="bet-submit"
                                >
                                    {t('propose')}
                                </Button>
                            </form>
                        ) : (
                            meId &&
                            others.length > 0 && (
                                <Button variant="stroke" icon="plus" onClick={() => setCreating(true)}>
                                    {t('new')}
                                </Button>
                            )
                        )}

                        {finished.length > 0 && (
                            <section className="grid gap-2">
                                <h3 className="text-h8 uppercase tracking-wide text-grey-1">{t('finishedTitle')}</h3>
                                <ul className="grid gap-1">
                                    {finished.map((bet) => (
                                        <li key={bet.id} className="flex justify-between gap-2 text-sm">
                                            <span className="min-w-0 truncate">
                                                <span className="font-bold">{bet.title}</span>{' '}
                                                <span className="text-grey-1">
                                                    {t('finishedLine', {
                                                        winner: nameOf(bet.winnerId!),
                                                        loser: nameOf(betLoser(bet, bet.winnerId!)),
                                                    })}
                                                </span>
                                            </span>
                                            {money(bet.amountMinor, 'shrink-0 font-bold')}
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

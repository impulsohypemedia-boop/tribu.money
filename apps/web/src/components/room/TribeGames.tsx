'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { Button } from '@/components/ui/Button'
import { Doodle } from '@/components/ui/Doodle'
import type { DoodleName } from '@/components/ui/doodles'
import type { CurrencyInfo, RoomState } from '@/lib/api-types'
import { betActions } from '@/lib/bets'
import { useErrorMessage } from '@/lib/error-messages'
import { fineVoterIds } from '@/lib/fines'
import { activeMembers } from '@/lib/members'
import { openPots } from '@/lib/pots'
import { useCreatePot } from '@/lib/queries/pots'
import { TOAST_MS } from '@/lib/toasts'
import { BetsDrawer } from './BetsDrawer'
import { FinesDrawer } from './FinesDrawer'
import { RouletteDrawer } from './RouletteDrawer'
import { MemberChips } from './Vaquita'

export type GameProps = {
    slug: string
    state: RoomState
    currencies?: readonly CurrencyInfo[]
    meId?: string | null
    token?: string | null
}

type Game = 'roulette' | 'bets' | 'fines'

/** What is waiting on this phone's person: bets to answer, fines to vote on or to pay. */
export function pendingForMe(state: RoomState, meId: string | null | undefined) {
    if (!meId) return { bets: 0, fines: 0 }
    const bets = (state.bets ?? []).filter((bet) => {
        const actions = betActions(bet, meId)
        return actions.includes('accept') || actions.includes('confirm')
    }).length
    const fines = (state.fines ?? []).filter(
        (fine) =>
            (fine.status === 'voting' &&
                fine.votes[meId] === undefined &&
                fineVoterIds(state.members, fine.memberId).includes(meId)) ||
            (fine.status === 'approved' && fine.memberId === meId)
    ).length
    return { bets, fines }
}

/**
 * El pozo de la tribu: one pot inside a tribu, kept in one member's account like a vaquita. The
 * round-ups and the fines go there. Shown only while the tribu has none open.
 */
export function TribePotSetup({ slug, state, meId, token, compact = false }: GameProps & { compact?: boolean }) {
    const t = useTranslations('room.games')
    const errorMessage = useErrorMessage()
    const createPot = useCreatePot(slug, token)
    const [open, setOpen] = useState(false)
    const [keeperId, setKeeperId] = useState(meId ?? '')
    const roster = activeMembers(state.members)

    const create = async () => {
        if (!keeperId) return
        try {
            await createPot.mutateAsync({ name: t('pot.defaultName'), keeperId })
            setOpen(false)
            toast(t('pot.created'), { duration: TOAST_MS.actionable })
        } catch (error) {
            toast.error(errorMessage(error), { duration: TOAST_MS.actionable })
        }
    }

    if (!open)
        return (
            <button
                type="button"
                onClick={() => setOpen(true)}
                className={
                    compact
                        ? 'text-left text-sm font-bold underline'
                        : 'flex w-full items-center gap-3 rounded-sm border border-dashed border-n-1 bg-white/60 p-3 text-left'
                }
                data-testid="tribe-pot-start"
            >
                {!compact && <Doodle name="expense_coins" size={26} weight={1.8} className="shrink-0" />}
                <span className="grid gap-0.5">
                    <span className={compact ? '' : 'text-h8'}>{t('pot.start')}</span>
                    {!compact && <span className="text-sm text-grey-1">{t('pot.startHint')}</span>}
                </span>
            </button>
        )

    return (
        <div className="grid gap-3 rounded-sm border border-n-1 bg-white p-3" data-testid="tribe-pot-form">
            <p className="text-h8">{t('pot.formTitle')}</p>
            <p className="text-sm text-grey-1">{t('pot.formHint')}</p>
            <span className="text-sm font-bold">{t('pot.keeper')}</span>
            <MemberChips members={roster} value={keeperId} onChange={setKeeperId} testId="tribe-pot-keeper" />
            <div className="flex gap-2">
                <Button variant="stroke" width="auto" className="flex-1 justify-center" onClick={() => setOpen(false)}>
                    {t('pot.cancel')}
                </Button>
                <Button
                    width="auto"
                    shadowSize="4"
                    className="flex-1 justify-center"
                    loading={createPot.isPending}
                    disabled={!keeperId}
                    onClick={() => void create()}
                    data-testid="tribe-pot-create"
                >
                    {t('pot.create')}
                </Button>
            </div>
        </div>
    )
}

function GameTile({
    doodle,
    label,
    hint,
    badge,
    onClick,
    testId,
}: {
    doodle: DoodleName
    label: string
    hint: string
    badge: number
    onClick: () => void
    testId: string
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            className="shadow-4 relative flex min-w-0 flex-col items-start gap-1 rounded-sm border border-n-1 bg-white p-3 text-left transition-transform active:translate-y-[2px]"
            data-testid={testId}
        >
            {badge > 0 && (
                <span className="absolute -right-1.5 -top-1.5 flex size-6 items-center justify-center rounded-full border border-n-1 bg-primary-1 text-xs font-bold">
                    {badge}
                </span>
            )}
            <Doodle name={doodle} size={26} weight={1.8} />
            <span className="text-h8 leading-tight">{label}</span>
            <span className="text-xs leading-snug text-grey-1">{hint}</span>
        </button>
    )
}

/** Ruleta, apuestas y multas, plus the tribu's pot when it has none yet. */
export function TribeGames(props: GameProps) {
    const t = useTranslations('room.games')
    const [game, setGame] = useState<Game | null>(null)
    const pending = pendingForMe(props.state, props.meId)
    const hasPot = openPots(props.state).length > 0
    const enoughPeople = activeMembers(props.state.members).length >= 2

    return (
        <section className="mb-5 grid gap-3" data-testid="tribe-games">
            <h2 className="text-h8 uppercase tracking-wide text-grey-1">{t('title')}</h2>
            {!hasPot && <TribePotSetup {...props} />}
            {enoughPeople && (
                <div className="grid grid-cols-3 gap-2">
                    <GameTile
                        doodle="expense_dices"
                        label={t('roulette.tile')}
                        hint={t('roulette.tileHint')}
                        badge={0}
                        onClick={() => setGame('roulette')}
                        testId="game-roulette"
                    />
                    <GameTile
                        doodle="expense_handshake"
                        label={t('bets.tile')}
                        hint={t('bets.tileHint')}
                        badge={pending.bets}
                        onClick={() => setGame('bets')}
                        testId="game-bets"
                    />
                    <GameTile
                        doodle="expense_flag"
                        label={t('fines.tile')}
                        hint={t('fines.tileHint')}
                        badge={pending.fines}
                        onClick={() => setGame('fines')}
                        testId="game-fines"
                    />
                </div>
            )}
            <RouletteDrawer open={game === 'roulette'} onClose={() => setGame(null)} {...props} />
            <BetsDrawer open={game === 'bets'} onClose={() => setGame(null)} {...props} />
            <FinesDrawer open={game === 'fines'} onClose={() => setGame(null)} {...props} />
        </section>
    )
}

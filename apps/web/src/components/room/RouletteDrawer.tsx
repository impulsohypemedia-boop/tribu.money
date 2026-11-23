'use client'

import { useEffect, useRef, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { BaseInput } from '@/components/ui/BaseInput'
import { Button } from '@/components/ui/Button'
import { CloseButton } from '@/components/ui/CloseButton'
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/Drawer'
import { DrawerBody } from '@/components/ui/DrawerLayout'
import { Icon } from '@/components/ui/Icon'
import { api } from '@/lib/api'
import type { ApiDraw } from '@/lib/api-types'
import { cn } from '@/lib/cn'
import { useErrorMessage } from '@/lib/error-messages'
import { activeMembers, defaultSplitMembers } from '@/lib/members'
import { decimalsOf, formatAmountInput, parseAmountToMinor } from '@/lib/money'
import { useSpinDraw } from '@/lib/queries/pots'
import { verifyDraw } from '@/lib/roulette'
import { useMotionAllowed } from '@/lib/use-motion'
import { useFeedback } from '@/lib/use-settings'
import { Money } from './Money'
import { MemberChips } from './Vaquita'
import type { GameProps } from './TribeGames'

const randomHex = (bytes: number) =>
    [...crypto.getRandomValues(new Uint8Array(bytes))].map((b) => b.toString(16).padStart(2, '0')).join('')

/** How long the names keep flashing before the result lands. */
const SPIN_MS = 2200

/** The proof under a result: the seeds, the hash, and whether this phone could redo the sum. */
export function DrawProof({ draw }: { draw: ApiDraw }) {
    const t = useTranslations('room.games.roulette')
    const [verified, setVerified] = useState<boolean | null>(null)
    useEffect(() => {
        let alive = true
        void verifyDraw(draw).then((ok) => alive && setVerified(ok))
        return () => {
            alive = false
        }
    }, [draw])
    return (
        <details className="rounded-sm border border-n-1 bg-white p-3 text-left text-sm" data-testid="draw-proof">
            <summary className="flex cursor-pointer items-center gap-2 font-bold">
                {verified === true && <Icon name="check" size={14} />}
                {verified === null ? t('proofChecking') : verified ? t('proofOk') : t('proofBad')}
            </summary>
            <p className="mt-2 text-grey-1">{t('proofHow')}</p>
            <dl className="mt-2 grid gap-1 break-all font-mono text-xs">
                <dt className="font-sans font-bold">{t('proofSealed')}</dt>
                <dd>{draw.seedHash}</dd>
                <dt className="font-sans font-bold">{t('proofSeed')}</dt>
                <dd>{draw.seed}</dd>
                <dt className="font-sans font-bold">{t('proofPhone')}</dt>
                <dd>{draw.clientSeed}</dd>
            </dl>
        </details>
    )
}

export function RouletteDrawer({
    open,
    onClose,
    slug,
    state,
    currencies,
    meId,
    token,
}: GameProps & { open: boolean; onClose: () => void }) {
    const t = useTranslations('room.games.roulette')
    const locale = useLocale()
    const errorMessage = useErrorMessage()
    const feedback = useFeedback()
    const motionAllowed = useMotionAllowed()
    const spin = useSpinDraw(slug, token)
    const decimals = decimalsOf(state.room.currency, currencies)
    const roster = activeMembers(state.members)

    const [sealed, setSealed] = useState<{ id: string; seedHash: string } | null>(null)
    const [description, setDescription] = useState('')
    const [amount, setAmount] = useState('')
    const [paidById, setPaidById] = useState(meId ?? '')
    const [inIds, setInIds] = useState<string[]>([])
    const [problem, setProblem] = useState<string | null>(null)
    const [flashing, setFlashing] = useState<string | null>(null)
    const [resultId, setResultId] = useState<string | null>(null)
    const timer = useRef<number | null>(null)

    useEffect(() => {
        if (!open) return
        setSealed(null)
        setDescription('')
        setAmount('')
        setPaidById(meId ?? '')
        setInIds(defaultSplitMembers(state.members).map((member) => member.id))
        setProblem(null)
        setFlashing(null)
        setResultId(null)
        // Seal the server's seed as the sheet opens, before anyone is picked.
        api.startDraw(slug, token)
            .then(setSealed)
            .catch((error) => setProblem(errorMessage(error)))
        return () => {
            if (timer.current) window.clearInterval(timer.current)
        }
        // Only on open: a poll landing mid-spin must not reset the sheet.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open])

    const nameOf = (id: string) => state.members.find((member) => member.id === id)?.name ?? t('someone')
    const result = resultId ? ((state.draws ?? []).find((draw) => draw.id === resultId) ?? null) : null

    const toggle = (id: string) =>
        setInIds((current) => (current.includes(id) ? current.filter((x) => x !== id) : [...current, id]))

    const go = async () => {
        setProblem(null)
        const parsed = parseAmountToMinor(amount, decimals, locale)
        if (parsed === null || BigInt(parsed) <= 0n) return setProblem(t('amountInvalid'))
        if (inIds.length < 2) return setProblem(t('tooFew'))
        if (!paidById) return setProblem(t('payerMissing'))
        if (!sealed) return setProblem(t('notSealed'))

        feedback('blip')
        if (motionAllowed) {
            let i = 0
            timer.current = window.setInterval(() => setFlashing(inIds[i++ % inIds.length]), 90)
        }
        const started = Date.now()
        try {
            await spin.mutateAsync({
                drawId: sealed.id,
                clientSeed: randomHex(16),
                participantIds: inIds,
                paidById,
                amountMinor: parsed,
                description: description.trim() || t('defaultDescription'),
            })
            const wait = motionAllowed ? Math.max(0, SPIN_MS - (Date.now() - started)) : 0
            window.setTimeout(() => {
                if (timer.current) window.clearInterval(timer.current)
                setFlashing(null)
                setResultId(sealed.id)
                feedback('thunk')
            }, wait)
        } catch (error) {
            if (timer.current) window.clearInterval(timer.current)
            setFlashing(null)
            feedback('error', { haptic: 'error' })
            setProblem(errorMessage(error))
        }
    }

    const spinning = flashing !== null || spin.isPending

    return (
        <Drawer open={open} onOpenChange={(next) => !next && !spinning && onClose()} repositionInputs={false}>
            <DrawerContent data-testid="roulette-drawer">
                <DrawerHeader className="flex flex-row items-end justify-between">
                    <DrawerTitle className="text-h5">{t('title')}</DrawerTitle>
                    <CloseButton onClick={onClose} label={t('close')} />
                </DrawerHeader>
                <DrawerBody>
                    {result ? (
                        <div className="grid gap-4 text-center" data-testid="roulette-result">
                            <p className="text-sm text-grey-1">{t('resultLead')}</p>
                            <p className="text-h3">{nameOf(result.winnerId)}</p>
                            <p className="text-sm">
                                {result.winnerId === result.paidById
                                    ? t.rich('resultInvites', {
                                          name: nameOf(result.winnerId),
                                          amount: () => (
                                              <Money
                                                  minor={result.amountMinor}
                                                  currency={state.room.currency}
                                                  catalog={currencies}
                                                  className="font-bold"
                                              />
                                          ),
                                      })
                                    : t.rich('resultPays', {
                                          name: nameOf(result.winnerId),
                                          payer: nameOf(result.paidById),
                                          amount: () => (
                                              <Money
                                                  minor={result.amountMinor}
                                                  currency={state.room.currency}
                                                  catalog={currencies}
                                                  className="font-bold"
                                              />
                                          ),
                                      })}
                            </p>
                            <DrawProof draw={result} />
                            <Button shadowSize="4" onClick={onClose}>
                                {t('done')}
                            </Button>
                        </div>
                    ) : (
                        <form
                            className="grid gap-4"
                            onSubmit={(event) => {
                                event.preventDefault()
                                void go()
                            }}
                        >
                            <p className="text-sm text-grey-1">{t('intro')}</p>
                            <label className="grid gap-1">
                                <span className="text-sm font-bold">{t('what')}</span>
                                <BaseInput
                                    value={description}
                                    onChange={(event) => setDescription(event.target.value)}
                                    placeholder={t('whatPlaceholder')}
                                    maxLength={80}
                                    disabled={spinning}
                                />
                            </label>
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
                                    variant="lg"
                                    className="text-center tabular-nums"
                                    disabled={spinning}
                                    data-testid="roulette-amount"
                                />
                            </label>
                            <div className="grid gap-2">
                                <span className="text-sm font-bold">{t('paidBy')}</span>
                                <MemberChips
                                    members={roster}
                                    value={paidById}
                                    onChange={setPaidById}
                                    testId="roulette-payer"
                                />
                            </div>
                            <div className="grid gap-2">
                                <span className="text-sm font-bold">{t('who')}</span>
                                <div className="flex flex-wrap gap-2" data-testid="roulette-who">
                                    {roster.map((member) => {
                                        const checked = inIds.includes(member.id)
                                        return (
                                            <button
                                                key={member.id}
                                                type="button"
                                                role="checkbox"
                                                aria-checked={checked}
                                                onClick={() => toggle(member.id)}
                                                disabled={spinning}
                                                className={cn(
                                                    'rounded-full border border-n-1 px-3 py-1.5 text-sm font-bold transition-colors',
                                                    flashing === member.id
                                                        ? 'scale-110 bg-primary-1'
                                                        : checked
                                                          ? 'bg-n-1 text-white'
                                                          : 'bg-white text-grey-1 line-through'
                                                )}
                                            >
                                                {member.name}
                                            </button>
                                        )
                                    })}
                                </div>
                            </div>
                            <p className="flex items-start gap-2 text-xs text-grey-1">
                                <Icon name="check" size={12} className="mt-0.5 shrink-0" />
                                <span>
                                    {sealed ? t('sealed', { hash: sealed.seedHash.slice(0, 10) }) : t('sealing')}
                                </span>
                            </p>
                            {problem && (
                                <p role="alert" className="text-sm font-bold text-error">
                                    {problem}
                                </p>
                            )}
                            <Button
                                type="submit"
                                shadowSize="4"
                                icon="dice"
                                loading={spinning}
                                disabled={!sealed}
                                data-testid="roulette-spin"
                            >
                                {spinning ? t('spinning') : t('spin')}
                            </Button>
                        </form>
                    )}
                </DrawerBody>
            </DrawerContent>
        </Drawer>
    )
}

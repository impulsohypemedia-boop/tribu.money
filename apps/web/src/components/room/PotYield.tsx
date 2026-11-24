'use client'

import { useMemo, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { BaseInput } from '@/components/ui/BaseInput'
import { Button } from '@/components/ui/Button'
import { Icon } from '@/components/ui/Icon'
import type { ApiPot, CurrencyInfo, RoomState } from '@/lib/api-types'
import { useErrorMessage } from '@/lib/error-messages'
import { formatAprPercent, parseAprPercent, potYield } from '@/lib/pot-yield'
import { useUpdatePot } from '@/lib/queries/pots'
import { Money } from './Money'

/** One line on the pot card: what the pot earned so far, when it earns. */
export function PotYieldLine({
    pot,
    state,
    currencies,
}: {
    pot: ApiPot
    state: RoomState
    currencies?: readonly CurrencyInfo[]
}) {
    const t = useTranslations('room.pot.yield')
    const earned = potYield(pot, state.expenses)
    if (!earned || earned.earnedMinor === '0') return null
    return (
        <span className="block truncate text-sm font-bold text-n-1" data-testid="pot-yield-line">
            {t.rich('cardLine', {
                amount: () => <Money minor={earned.earnedMinor} currency={state.room.currency} catalog={currencies} />,
            })}
        </span>
    )
}

/**
 * La vaquita que rinde. The rate is what the keeper's account pays (Lemon, a bank, anything);
 * Tribu only does the sum and says it is an estimate. The money does not move because of this.
 */
export function PotYieldCard({
    pot,
    state,
    currencies,
    slug,
    token,
    keeper,
}: {
    pot: ApiPot
    state: RoomState
    currencies?: readonly CurrencyInfo[]
    slug: string
    token?: string | null
    keeper: string
}) {
    const t = useTranslations('room.pot.yield')
    const locale = useLocale()
    const errorMessage = useErrorMessage()
    const updatePot = useUpdatePot(slug, token)
    const [editing, setEditing] = useState(false)
    const [rate, setRate] = useState('')
    const [problem, setProblem] = useState<string | null>(null)
    const result = useMemo(() => potYield(pot, state.expenses), [pot, state.expenses])
    const money = (minor: string) => (
        <Money minor={minor} currency={state.room.currency} catalog={currencies} className="font-bold" />
    )

    const save = async (bps: number | null) => {
        try {
            await updatePot.mutateAsync({ potId: pot.id, yieldAprBps: bps })
            setEditing(false)
            setProblem(null)
        } catch (error) {
            setProblem(errorMessage(error))
        }
    }

    const startEditing = () => {
        setRate(pot.yieldAprBps ? formatAprPercent(pot.yieldAprBps, locale) : '')
        setProblem(null)
        setEditing(true)
    }

    if (pot.closedAt && !result) return null

    if (editing)
        return (
            <form
                className="grid gap-3 rounded-sm border border-n-1 bg-white p-3"
                onSubmit={(event) => {
                    event.preventDefault()
                    const bps = parseAprPercent(rate)
                    if (bps === null) return setProblem(t('rateInvalid'))
                    void save(bps)
                }}
                data-testid="pot-yield-form"
            >
                <label className="grid gap-1">
                    <span className="text-sm font-bold">{t('rateLabel')}</span>
                    <span className="flex items-center gap-2">
                        <BaseInput
                            value={rate}
                            onChange={(event) => setRate(event.target.value)}
                            inputMode="decimal"
                            autoComplete="off"
                            maxLength={5}
                            className="w-24 text-center tabular-nums"
                            data-testid="pot-yield-rate"
                        />
                        <span className="text-sm">{t('perYear')}</span>
                    </span>
                </label>
                <p className="text-xs text-grey-1">{t('rateHint', { name: keeper })}</p>
                {problem && (
                    <p role="alert" className="text-sm font-bold text-error">
                        {problem}
                    </p>
                )}
                <div className="flex gap-2">
                    {pot.yieldAprBps ? (
                        <Button
                            type="button"
                            variant="stroke"
                            width="auto"
                            className="flex-1 justify-center"
                            onClick={() => void save(null)}
                        >
                            {t('turnOff')}
                        </Button>
                    ) : (
                        <Button
                            type="button"
                            variant="stroke"
                            width="auto"
                            className="flex-1 justify-center"
                            onClick={() => setEditing(false)}
                        >
                            {t('cancel')}
                        </Button>
                    )}
                    <Button
                        type="submit"
                        width="auto"
                        shadowSize="4"
                        className="flex-1 justify-center"
                        loading={updatePot.isPending}
                        data-testid="pot-yield-save"
                    >
                        {t('save')}
                    </Button>
                </div>
            </form>
        )

    if (!result)
        return (
            <button
                type="button"
                onClick={startEditing}
                className="flex items-center gap-3 rounded-sm border border-dashed border-n-1 bg-white/60 p-3 text-left"
                data-testid="pot-yield-start"
            >
                <Icon name="sparkles" size={20} className="shrink-0" />
                <span className="grid gap-0.5">
                    <span className="text-h8">{t('startTitle')}</span>
                    <span className="text-sm text-grey-1">{t('startHint')}</span>
                </span>
            </button>
        )

    return (
        <div className="grid gap-2 rounded-sm border-2 border-n-1 bg-secondary-1/20 p-3" data-testid="pot-yield">
            <span className="flex items-center justify-between gap-2">
                <span className="text-h10 font-bold uppercase tracking-wide text-grey-1">
                    {t('badge', { rate: formatAprPercent(pot.yieldAprBps!, locale) })}
                </span>
                {!pot.closedAt && (
                    <button type="button" onClick={startEditing} className="text-sm font-bold underline">
                        {t('edit')}
                    </button>
                )}
            </span>
            <span className="text-h7">{t.rich('earned', { amount: () => money(result.earnedMinor) })}</span>
            {result.nextYearMinor !== '0' && (
                <span className="text-sm">{t.rich('nextYear', { amount: () => money(result.nextYearMinor) })}</span>
            )}
            <span className="text-xs text-grey-1">{t('estimateNote', { name: keeper })}</span>
        </div>
    )
}

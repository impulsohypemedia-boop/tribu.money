'use client'

import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { Money } from '@/components/room/Money'
import type { CurrencyInfo, RoomState } from '@/lib/api-types'
import { useErrorMessage } from '@/lib/error-messages'
import { useStopRecurring } from '@/lib/queries/recurring'
import { TOAST_MS } from '@/lib/toasts'

/** The room's monthly expenses, each with a way to stop it. Hidden while there are none. */
export function MonthlyExpenses({ state, currencies }: { state: RoomState; currencies?: readonly CurrencyInfo[] }) {
    const t = useTranslations('room.monthly')
    const errorMessage = useErrorMessage()
    const stop = useStopRecurring(state.room.slug)
    const items = state.recurring ?? []
    if (items.length === 0) return null

    const nameOf = (id: string | null) => state.members.find((member) => member.id === id)?.name ?? ''

    return (
        <section className="grid gap-2" data-testid="monthly-expenses">
            <h3 className="text-h8 uppercase tracking-wide text-grey-1">{t('title')}</h3>
            <ul className="grid gap-2">
                {items.map((item) => (
                    <li key={item.id} className="flex items-center gap-3 rounded-sm border border-n-1 bg-white p-3">
                        <span className="min-w-0 flex-1">
                            <span className="block truncate text-h8">{item.description || t('unnamed')}</span>
                            <span className="block text-sm text-grey-1">
                                <Money minor={item.amountMinor} currency={item.currency} catalog={currencies} /> ·{' '}
                                {t('everyMonth', { day: item.dayOfMonth, name: nameOf(item.paidById) })}
                            </span>
                        </span>
                        <button
                            type="button"
                            className="shrink-0 rounded-full border border-n-1 px-3 py-1.5 text-sm font-bold"
                            disabled={stop.isPending}
                            onClick={() =>
                                stop.mutate(item.id, {
                                    onSuccess: () => toast.success(t('stopped'), { duration: TOAST_MS.default }),
                                    onError: (error) =>
                                        toast.error(errorMessage(error, t('stopFailed')), {
                                            duration: TOAST_MS.actionable,
                                        }),
                                })
                            }
                            data-testid="stop-monthly"
                        >
                            {t('stop')}
                        </button>
                    </li>
                ))}
            </ul>
        </section>
    )
}

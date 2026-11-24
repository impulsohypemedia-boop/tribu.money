'use client'

import { useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { Button } from '@/components/ui/Button'
import { Doodle } from '@/components/ui/Doodle'
import type { CurrencyInfo, RoomState } from '@/lib/api-types'
import { isApiError } from '@/lib/api'
import { useErrorMessage } from '@/lib/error-messages'
import { formatMoney } from '@/lib/money'
import { useDismissReminder, useSendReminder } from '@/lib/queries/reminders'
import { checkReminder, reminderNoticeFor } from '@/lib/reminders'
import { TOAST_MS } from '@/lib/toasts'
import { MemberAvatar } from './MemberAvatar'
import { Money } from './Money'

interface ReminderProps {
    slug: string
    state: RoomState
    currencies: readonly CurrencyInfo[]
    meId?: string | null
    token?: string | null
}

/**
 * Recordatorio amable, for the person who is owed money: everyone who still has to pass them
 * something, each with a "Recordale" button. The reminder shows up in the app for the other
 * person, and can also go out over WhatsApp with a kind message ready to send.
 */
export function RemindersCard({ slug, state, currencies, meId, token }: ReminderProps) {
    const t = useTranslations('room.reminders')
    const locale = useLocale()
    const errorMessage = useErrorMessage()
    const send = useSendReminder(slug, token)
    const [openId, setOpenId] = useState<string | null>(null)

    if (!meId || state.room.kind === 'vaquita') return null
    const owedToMe = state.suggestedTransfers.filter((transfer) => transfer.toId === meId)
    if (owedToMe.length === 0) return null

    const memberOf = (id: string) => state.members.find((member) => member.id === id)
    const me = memberOf(meId)
    const roomUrl = typeof window === 'undefined' ? '' : `${window.location.origin}/r/${slug}`

    const remind = async (toId: string, channel: 'whatsapp' | 'app') => {
        try {
            await send.mutateAsync(toId)
            setOpenId(null)
            toast(channel === 'app' ? t('sentApp') : t('sentWhatsapp'), { duration: TOAST_MS.state })
        } catch (error) {
            // Someone else may have reminded them a moment ago; the card redraws with the new date.
            if (isApiError(error, 'REMINDER_TOO_SOON')) toast(t('tooSoonToast'), { duration: TOAST_MS.state })
            else toast.error(errorMessage(error), { duration: TOAST_MS.actionable })
        }
    }

    return (
        <section className="mb-4 grid gap-2 rounded-sm border border-n-1 bg-white p-3" data-testid="reminders-card">
            <div className="flex items-center gap-2">
                <Doodle name="iconhandcoins" size={24} weight={1.8} className="shrink-0" aria-hidden />
                <h2 className="text-h8">{t('title')}</h2>
            </div>
            <ul className="grid gap-2">
                {owedToMe.map((transfer) => {
                    const debtor = memberOf(transfer.fromId)
                    if (!debtor) return null
                    const check = checkReminder(state, meId, debtor.id)
                    const amount = formatMoney(transfer.amountMinor, state.room.currency, currencies, locale)
                    const message = t('message', {
                        name: debtor.name,
                        tribu: state.room.name,
                        amount,
                        me: me?.name ?? '',
                        url: roomUrl,
                    })
                    const isOpen = openId === debtor.id
                    return (
                        <li
                            key={debtor.id}
                            className="grid gap-2 rounded-sm border border-n-1 p-2"
                            data-testid="reminder-row"
                        >
                            <div className="flex items-center gap-2">
                                <MemberAvatar
                                    name={debtor.name}
                                    avatar={debtor.avatar}
                                    palette={debtor.avatarPalette}
                                    size={28}
                                />
                                <span className="min-w-0 flex-1 truncate text-sm">
                                    {t('passesYou', { name: debtor.name })}{' '}
                                    <Money
                                        minor={transfer.amountMinor}
                                        currency={state.room.currency}
                                        catalog={currencies}
                                        className="font-bold"
                                    />
                                </span>
                                {check.ok ? (
                                    <Button
                                        variant="stroke"
                                        size="small"
                                        width="auto"
                                        onClick={() => setOpenId(isOpen ? null : debtor.id)}
                                        data-testid="reminder-open"
                                    >
                                        {t('remind')}
                                    </Button>
                                ) : null}
                            </div>
                            {!check.ok && check.reason === 'too-soon' && (
                                <p className="text-xs text-grey-1" data-testid="reminder-wait">
                                    {t('waitUntil', {
                                        date: check.nextAt.toLocaleDateString(locale, {
                                            weekday: 'long',
                                            day: 'numeric',
                                        }),
                                    })}
                                </p>
                            )}
                            {isOpen && check.ok && (
                                <div className="grid gap-2" data-testid="reminder-compose">
                                    <p className="whitespace-pre-line rounded-sm bg-primary-1/40 p-2 text-sm">
                                        {message}
                                    </p>
                                    <p className="text-xs text-grey-1">{t('limitHint')}</p>
                                    <div className="flex flex-wrap gap-2">
                                        {/* A real link, so the phone opens WhatsApp from the tap itself;
                                            opening it after the request returns gets blocked as a popup. */}
                                        <a
                                            href={`https://wa.me/?text=${encodeURIComponent(message)}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            onClick={() => void remind(debtor.id, 'whatsapp')}
                                            className="flex flex-1 items-center justify-center gap-2 rounded-sm border border-n-1 bg-green-1 px-3 py-2 text-sm font-bold"
                                            data-testid="reminder-whatsapp"
                                        >
                                            <Doodle name="channelwhatsapp" size={20} weight={1.8} aria-hidden />
                                            {t('sendWhatsapp')}
                                        </a>
                                        <Button
                                            variant="stroke"
                                            size="small"
                                            width="auto"
                                            className="flex-1 justify-center"
                                            loading={send.isPending}
                                            onClick={() => void remind(debtor.id, 'app')}
                                            data-testid="reminder-app"
                                        >
                                            {t('sendApp')}
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </li>
                    )
                })}
            </ul>
        </section>
    )
}

/** For the person reminded: a kind notice at the top of the tribu until they pay or put it away. */
export function ReminderNotice({
    slug,
    state,
    currencies,
    meId,
    token,
    onSettle,
}: ReminderProps & { onSettle: () => void }) {
    const t = useTranslations('room.reminders')
    const errorMessage = useErrorMessage()
    const dismiss = useDismissReminder(slug, token)
    const notice = reminderNoticeFor(state, meId ?? undefined)
    if (!notice) return null
    const from = state.members.find((member) => member.id === notice.reminder.fromId)

    const later = async () => {
        try {
            await dismiss.mutateAsync(notice.reminder.id)
        } catch (error) {
            toast.error(errorMessage(error), { duration: TOAST_MS.actionable })
        }
    }

    return (
        <div
            role="status"
            className="shadow-4 mx-4 flex items-start gap-3 rounded-sm border border-n-1 bg-white p-3"
            data-testid="reminder-notice"
        >
            <Doodle name="iconhandcoins" size={28} weight={1.8} className="mt-0.5 shrink-0" aria-hidden />
            <div className="grid min-w-0 flex-1 gap-2">
                <p className="text-sm">
                    {t('noticeLead', { name: from?.name ?? t('someone') })}{' '}
                    <Money
                        minor={notice.transfer.amountMinor}
                        currency={state.room.currency}
                        catalog={currencies}
                        className="font-bold"
                    />
                    {t('noticeTail')}
                </p>
                <div className="flex gap-2">
                    <Button
                        size="small"
                        width="auto"
                        shadowSize="4"
                        className="flex-1 justify-center"
                        onClick={onSettle}
                        data-testid="reminder-settle"
                    >
                        {t('settleNow')}
                    </Button>
                    <Button
                        variant="stroke"
                        size="small"
                        width="auto"
                        className="flex-1 justify-center"
                        loading={dismiss.isPending}
                        onClick={() => void later()}
                        data-testid="reminder-dismiss"
                    >
                        {t('later')}
                    </Button>
                </div>
            </div>
        </div>
    )
}

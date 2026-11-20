'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useLocale, useTranslations } from 'next-intl'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Money } from '@/components/room/Money'
import { BaseInput } from '@/components/ui/BaseInput'
import { Button } from '@/components/ui/Button'
import { Doodle } from '@/components/ui/Doodle'
import { Icon } from '@/components/ui/Icon'
import { api } from '@/lib/api'
import { cn } from '@/lib/cn'
import { readIdentity } from '@/lib/identity'
import { myActivity, type MyRoom } from '@/lib/my-overview'
import { readMyWallet, writeMyWallet, type MyWallet } from '@/lib/my-wallet'
import {
    DEFAULT_PAYOUT_NETWORK,
    normalizePayoutAddress,
    PAYOUT_NETWORK_KEYS,
    PAYOUT_NETWORKS,
    PAYOUT_TOKENS,
    type PayoutNetwork,
    type PayoutToken,
} from '@/lib/payout'
import { roomKey } from '@/lib/queries/core'
import { useMyRooms } from '@/lib/queries/my-rooms'
import { useCurrencies } from '@/lib/queries/reads'
import { TOAST_MS } from '@/lib/toasts'
import { tribeMilestones } from '@/lib/tribe-milestones'

const pill = (active: boolean) =>
    cn(
        'rounded-full border px-3 py-1.5 text-sm font-bold transition-colors',
        active ? 'border-n-1 bg-primary-1 text-n-1' : 'border-[#DCC5B4] bg-white text-grey-1'
    )

const hasWallet = (room: MyRoom, wallet: MyWallet) => {
    const me = room.state.members.find((member) => member.id === room.meId)
    return (
        me?.payoutAddress === normalizePayoutAddress(wallet.network, wallet.address) &&
        me?.payoutNetwork === wallet.network &&
        me?.payoutToken === wallet.token
    )
}

/** "Mi wallet": typed once here, written onto every tribu this device joined. */
function WalletSection({ rooms }: { rooms: MyRoom[] }) {
    const t = useTranslations('appShell.me')
    const queryClient = useQueryClient()
    const [saved, setSaved] = useState<MyWallet | null>(null)
    const [token, setToken] = useState<PayoutToken>('USDT')
    const [network, setNetwork] = useState<PayoutNetwork>(DEFAULT_PAYOUT_NETWORK)
    const [address, setAddress] = useState('')
    const [invalid, setInvalid] = useState(false)
    const [saving, setSaving] = useState(false)

    useEffect(() => {
        const wallet = readMyWallet()
        setSaved(wallet)
        if (wallet) {
            setToken(wallet.token)
            setNetwork(wallet.network)
            setAddress(wallet.address)
        }
    }, [])

    const joined = rooms.filter((room) => room.meId && readIdentity(room.slug)?.token)
    const withWallet = saved ? joined.filter((room) => hasWallet(room, saved)).length : 0

    const save = async () => {
        const normalized = normalizePayoutAddress(network, address)
        if (!normalized) {
            setInvalid(true)
            return
        }
        setInvalid(false)
        setSaving(true)
        const wallet: MyWallet = { token, network, address: normalized }
        writeMyWallet(wallet)
        setSaved(wallet)
        const results = await Promise.allSettled(
            joined.map(async (room) => {
                const next = await api.setMemberProfile(
                    room.slug,
                    room.meId!,
                    { payout: wallet },
                    readIdentity(room.slug)?.token
                )
                queryClient.setQueryData(roomKey(room.slug), next)
            })
        )
        setSaving(false)
        const failed = results.filter((result) => result.status === 'rejected').length
        if (failed > 0) toast.error(t('walletPartial', { count: failed }), { duration: TOAST_MS.actionable })
        else toast.success(t('walletSaved', { count: joined.length }), { duration: TOAST_MS.default })
    }

    return (
        <section className="shadow-4 rounded-sm border border-n-1 bg-white p-4" data-testid="me-wallet">
            <h2 className="flex items-center gap-2 text-h6">
                <Doodle name="iconwallet" size={22} weight={1.9} />
                {t('walletTitle')}
            </h2>
            <p className="mt-1 text-sm text-grey-1">{t('walletHint')}</p>
            <div className="mt-3 flex gap-2" role="radiogroup" aria-label={t('token')}>
                {PAYOUT_TOKENS.map((option) => (
                    <button
                        key={option}
                        type="button"
                        role="radio"
                        aria-checked={token === option}
                        className={pill(token === option)}
                        onClick={() => setToken(option)}
                    >
                        {option}
                    </button>
                ))}
            </div>
            <div className="mt-2 flex flex-wrap gap-2" role="radiogroup" aria-label={t('network')}>
                {PAYOUT_NETWORK_KEYS.map((option) => (
                    <button
                        key={option}
                        type="button"
                        role="radio"
                        aria-checked={network === option}
                        className={pill(network === option)}
                        onClick={() => setNetwork(option)}
                    >
                        {PAYOUT_NETWORKS[option].label}
                    </button>
                ))}
            </div>
            <label className="mt-3 grid gap-1">
                <span className="text-h8 uppercase tracking-wide text-grey-1">{t('address')}</span>
                <BaseInput
                    value={address}
                    onChange={(event) => {
                        setAddress(event.target.value)
                        setInvalid(false)
                    }}
                    placeholder={PAYOUT_NETWORKS[network].format === 'tron' ? 'T…' : '0x…'}
                    autoCapitalize="off"
                    autoCorrect="off"
                    spellCheck={false}
                    className="font-mono text-sm"
                    data-testid="me-wallet-address"
                />
                {invalid && (
                    <span role="alert" className="text-sm font-bold text-error">
                        {t('addressInvalid', { network: PAYOUT_NETWORKS[network].label })}
                    </span>
                )}
            </label>
            <Button
                variant="primary"
                className="mt-3 justify-center"
                onClick={() => void save()}
                loading={saving}
                data-testid="me-wallet-save"
            >
                {joined.length > 0 ? t('walletSaveAll', { count: joined.length }) : t('walletSave')}
            </Button>
            {saved && joined.length > 0 && (
                <p className="mt-2 text-center text-xs text-grey-1">
                    {t('walletStatus', { done: withWallet, total: joined.length })}
                </p>
            )}
        </section>
    )
}

export function MeScreen() {
    const t = useTranslations('appShell.me')
    const tMilestones = useTranslations('room.milestones')
    const locale = useLocale()
    const { rooms } = useMyRooms()
    const { data: catalog } = useCurrencies()
    const activity = useMemo(() => myActivity(rooms), [rooms])
    const milestones = useMemo(
        () =>
            rooms
                .map((room) => {
                    const list = tribeMilestones(room.state)
                    return {
                        slug: room.slug,
                        name: room.state.room.name,
                        reached: list.filter((m) => m.reached).length,
                        total: list.length,
                    }
                })
                .filter((room) => room.reached > 0)
                .sort((a, b) => b.reached - a.reached),
        [rooms]
    )
    const totalReached = milestones.reduce((sum, room) => sum + room.reached, 0)
    const date = (iso: string) =>
        new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short' }).format(new Date(iso))

    return (
        <div className="grid gap-7 px-5 pt-5" data-testid="me">
            <WalletSection rooms={rooms} />

            <section data-testid="me-milestones">
                <h2 className="text-h6">{t('milestonesTitle')}</h2>
                {milestones.length === 0 ? (
                    <p className="mt-2 text-sm text-grey-1">{t('milestonesEmpty')}</p>
                ) : (
                    <>
                        <p className="mt-1 text-sm text-grey-1">{t('milestonesTotal', { count: totalReached })}</p>
                        <ul className="mt-3 grid gap-2">
                            {milestones.map((room) => (
                                <li key={room.slug}>
                                    <Link
                                        href={`/r/${encodeURIComponent(room.slug)}`}
                                        className="flex items-center gap-3 rounded-sm border border-n-1 bg-white p-3 no-underline"
                                    >
                                        <Doodle name="party" size={22} weight={1.8} />
                                        <span className="min-w-0 flex-1 truncate text-h8">{room.name}</span>
                                        <span className="text-sm text-grey-1">
                                            {tMilestones('cardLine', { reached: room.reached, total: room.total })}
                                        </span>
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    </>
                )}
            </section>

            <section data-testid="me-activity">
                <h2 className="text-h6">{t('activityTitle')}</h2>
                {activity.length === 0 ? (
                    <p className="mt-2 text-sm text-grey-1">{t('activityEmpty')}</p>
                ) : (
                    <ul className="mt-3 divide-y divide-dashed divide-grey-2 rounded-sm border border-n-1 bg-white">
                        {activity.map((item) => (
                            <li key={`${item.slug}-${item.kind}-${item.at}-${item.label}`}>
                                <Link
                                    href={`/r/${encodeURIComponent(item.slug)}`}
                                    className="flex items-center gap-3 px-3 py-2.5 no-underline"
                                >
                                    <span className="min-w-0 flex-1">
                                        <span className="block truncate text-sm font-bold">
                                            {t(`activity.${item.kind}`, { label: item.label })}
                                        </span>
                                        <span className="block truncate text-xs text-grey-1">
                                            {item.roomName} · {date(item.at)}
                                        </span>
                                    </span>
                                    <Money
                                        minor={item.amountMinor}
                                        currency={item.currency}
                                        catalog={catalog}
                                        className="text-sm font-bold"
                                    />
                                    <Icon name="chevron-right" size={16} className="shrink-0 text-grey-1" />
                                </Link>
                            </li>
                        ))}
                    </ul>
                )}
            </section>
        </div>
    )
}

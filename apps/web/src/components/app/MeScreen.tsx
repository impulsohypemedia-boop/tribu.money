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
import {
    memberHasProfile,
    profileInput,
    readMyPaymentProfile,
    writeMyPaymentProfile,
    type MyPaymentProfile,
} from '@/lib/my-payment-profile'
import {
    DEFAULT_PAYOUT_NETWORK,
    normalizeBankAccount,
    normalizeLemonTag,
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
import { BadgesSection } from './BadgesSection'

const pill = (active: boolean) =>
    cn(
        'rounded-full border px-3 py-1.5 text-sm font-bold transition-colors',
        active ? 'border-n-1 bg-primary-1 text-n-1' : 'border-[#D6D3CC] bg-white text-grey-1'
    )

/**
 * "Cómo te pagan": alias or CBU/CVU, Lemon tag and wallet, typed once here and written onto every
 * tribu this device joined. Every part is optional; a tribu only uses what is filled in.
 */
function PaymentProfileSection({ rooms }: { rooms: MyRoom[] }) {
    const t = useTranslations('appShell.me')
    const queryClient = useQueryClient()
    const [saved, setSaved] = useState<MyPaymentProfile | null>(null)
    const [bank, setBank] = useState('')
    const [lemonTag, setLemonTag] = useState('')
    const [withCrypto, setWithCrypto] = useState(false)
    const [token, setToken] = useState<PayoutToken>('USDT')
    const [network, setNetwork] = useState<PayoutNetwork>(DEFAULT_PAYOUT_NETWORK)
    const [address, setAddress] = useState('')
    const [invalid, setInvalid] = useState<'bank' | 'lemonTag' | 'address' | null>(null)
    const [saving, setSaving] = useState(false)

    useEffect(() => {
        const profile = readMyPaymentProfile()
        setSaved(profile)
        if (!profile) return
        setBank(profile.bank ?? '')
        setLemonTag(profile.lemonTag ? `@${profile.lemonTag}` : '')
        if (profile.crypto) {
            setWithCrypto(true)
            setToken(profile.crypto.token)
            setNetwork(profile.crypto.network)
            setAddress(profile.crypto.address)
        }
    }, [])

    const joined = rooms.filter((room) => room.meId && readIdentity(room.slug)?.token)
    const upToDate = saved
        ? joined.filter((room) =>
              memberHasProfile(
                  room.state.members.find((member) => member.id === room.meId),
                  saved
              )
          ).length
        : 0

    const save = async () => {
        const normalizedBank = bank.trim() ? normalizeBankAccount(bank) : null
        if (bank.trim() && !normalizedBank) return setInvalid('bank')
        const normalizedTag = lemonTag.trim() ? normalizeLemonTag(lemonTag) : null
        if (lemonTag.trim() && !normalizedTag) return setInvalid('lemonTag')
        const normalizedAddress = withCrypto && address.trim() ? normalizePayoutAddress(network, address) : null
        if (withCrypto && address.trim() && !normalizedAddress) return setInvalid('address')
        setInvalid(null)
        setSaving(true)
        const profile: MyPaymentProfile = {
            bank: normalizedBank,
            lemonTag: normalizedTag,
            crypto: normalizedAddress ? { token, network, address: normalizedAddress } : null,
        }
        writeMyPaymentProfile(profile)
        setSaved(profile)
        const results = await Promise.allSettled(
            joined.map(async (room) => {
                const next = await api.setMemberProfile(
                    room.slug,
                    room.meId!,
                    profileInput(profile),
                    readIdentity(room.slug)?.token
                )
                queryClient.setQueryData(roomKey(room.slug), next)
            })
        )
        setSaving(false)
        const failed = results.filter((result) => result.status === 'rejected').length
        if (failed > 0) toast.error(t('profilePartial', { count: failed }), { duration: TOAST_MS.actionable })
        else toast.success(t('profileSaved', { count: joined.length }), { duration: TOAST_MS.default })
    }

    return (
        <section className="shadow-4 grid gap-3 rounded-sm border border-n-1 bg-white p-4" data-testid="me-profile">
            <div>
                <h2 className="flex items-center gap-2 text-h6">
                    <Doodle name="iconwallet" size={22} weight={1.9} />
                    {t('profileTitle')}
                </h2>
                <p className="mt-1 text-sm text-grey-1">{t('profileHint')}</p>
            </div>

            <label className="grid gap-1">
                <span className="text-h8 uppercase tracking-wide text-grey-1">{t('bank')}</span>
                <BaseInput
                    value={bank}
                    onChange={(event) => {
                        setBank(event.target.value)
                        setInvalid(null)
                    }}
                    placeholder={t('bankPlaceholder')}
                    autoCapitalize="off"
                    autoCorrect="off"
                    spellCheck={false}
                    className="font-mono text-sm"
                    data-testid="me-bank"
                />
                {invalid === 'bank' && (
                    <span role="alert" className="text-sm font-bold text-error">
                        {t('bankInvalid')}
                    </span>
                )}
            </label>

            <label className="grid gap-1">
                <span className="text-h8 uppercase tracking-wide text-grey-1">{t('lemonTag')}</span>
                <BaseInput
                    value={lemonTag}
                    onChange={(event) => {
                        setLemonTag(event.target.value)
                        setInvalid(null)
                    }}
                    placeholder="@tulemontag"
                    autoCapitalize="off"
                    autoCorrect="off"
                    spellCheck={false}
                    className="font-mono text-sm"
                    data-testid="me-lemontag"
                />
                {invalid === 'lemonTag' && (
                    <span role="alert" className="text-sm font-bold text-error">
                        {t('lemonTagInvalid')}
                    </span>
                )}
            </label>

            <div className="grid gap-2">
                <span className="text-h8 uppercase tracking-wide text-grey-1">{t('crypto')}</span>
                {!withCrypto ? (
                    <button
                        type="button"
                        className="justify-self-start text-sm font-bold underline"
                        onClick={() => setWithCrypto(true)}
                        data-testid="me-crypto-add"
                    >
                        {t('cryptoAdd')}
                    </button>
                ) : (
                    <>
                        <div className="flex gap-2" role="radiogroup" aria-label={t('token')}>
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
                        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={t('network')}>
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
                        <BaseInput
                            value={address}
                            onChange={(event) => {
                                setAddress(event.target.value)
                                setInvalid(null)
                            }}
                            aria-label={t('address')}
                            placeholder={PAYOUT_NETWORKS[network].format === 'tron' ? 'T…' : '0x…'}
                            autoCapitalize="off"
                            autoCorrect="off"
                            spellCheck={false}
                            className="font-mono text-sm"
                            data-testid="me-wallet-address"
                        />
                        {invalid === 'address' && (
                            <span role="alert" className="text-sm font-bold text-error">
                                {t('addressInvalid', { network: PAYOUT_NETWORKS[network].label })}
                            </span>
                        )}
                        <button
                            type="button"
                            className="justify-self-start text-sm text-grey-1 underline"
                            onClick={() => {
                                setWithCrypto(false)
                                setAddress('')
                                setInvalid(null)
                            }}
                        >
                            {t('cryptoRemove')}
                        </button>
                    </>
                )}
            </div>

            <p className="text-xs text-grey-1">{t('profilePrivacy')}</p>
            <Button
                variant="primary"
                className="justify-center"
                onClick={() => void save()}
                loading={saving}
                data-testid="me-profile-save"
            >
                {joined.length > 0 ? t('profileSaveAll', { count: joined.length }) : t('profileSave')}
            </Button>
            {saved && joined.length > 0 && (
                <p className="text-center text-xs text-grey-1">
                    {t('profileStatus', { done: upToDate, total: joined.length })}
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
            <PaymentProfileSection rooms={rooms} />

            <BadgesSection rooms={rooms} />

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

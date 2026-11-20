'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { QRCodeSVG } from 'qrcode.react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/Button'
import { BaseInput } from '@/components/ui/BaseInput'
import { Icon } from '@/components/ui/Icon'
import { SettingToggle } from '@/components/ui/SettingToggle'
import type { ApiMember } from '@/lib/api-types'
import { copyText } from '@/lib/clipboard'
import { cn } from '@/lib/cn'
import { useErrorMessage } from '@/lib/error-messages'
import {
    DEFAULT_PAYOUT_NETWORK,
    PAYOUT_NETWORKS,
    PAYOUT_NETWORK_KEYS,
    PAYOUT_TOKENS,
    normalizePayoutAddress,
    payoutOf,
    shortAddress,
    type MemberPayout,
    type PayoutNetwork,
    type PayoutToken,
} from '@/lib/payout'
import { useSetMemberProfile } from '@/lib/queries/members-settings'
import { TOAST_MS } from '@/lib/toasts'

/**
 * Where to send a member their money: token, network and address, with copy and a QR code.
 * Read-only. Tribu never sends anything from here; the payer uses their own wallet or app.
 */
export function PayoutCard({ payout, name }: { payout: MemberPayout; name: string }) {
    const t = useTranslations('room.profile')
    const [showQr, setShowQr] = useState(false)

    const copy = async () => {
        const ok = await copyText(payout.address)
        if (ok) toast.success(t('copied'), { duration: TOAST_MS.default })
    }

    return (
        <div className="rounded-sm border border-n-1 bg-white p-3" data-testid="payout-card">
            <p className="text-sm text-grey-1">{t('payTo', { name })}</p>
            <div className="mt-2 flex items-center gap-2">
                <span className="rounded-full bg-secondary-1 px-2 py-0.5 text-xs font-bold">{payout.token}</span>
                <span className="rounded-full bg-primary-3 px-2 py-0.5 text-xs font-bold">
                    {PAYOUT_NETWORKS[payout.network].label}
                </span>
                <span className="min-w-0 flex-1 truncate font-mono text-sm" title={payout.address}>
                    {shortAddress(payout.address)}
                </span>
            </div>
            <div className="mt-3 flex gap-2">
                <Button
                    variant="stroke"
                    width="auto"
                    className="flex-1 justify-center text-sm"
                    icon="copy"
                    onClick={copy}
                >
                    {t('copy')}
                </Button>
                <Button
                    variant="stroke"
                    width="auto"
                    className="flex-1 justify-center text-sm"
                    onClick={() => setShowQr((open) => !open)}
                >
                    {showQr ? t('hideQr') : t('showQr')}
                </Button>
            </div>
            {showQr && (
                <div className="mt-3 flex justify-center rounded-sm bg-white p-2">
                    <QRCodeSVG value={payout.address} size={168} marginSize={1} />
                </div>
            )}
            <p className="mt-2 text-xs text-grey-1">
                {t('networkWarning', { network: PAYOUT_NETWORKS[payout.network].label })}
            </p>
        </div>
    )
}

/** The member's own payout details, editable. */
function PayoutEditor({ member, slug, token }: { member: ApiMember; slug: string; token?: string | null }) {
    const t = useTranslations('room.profile')
    const errorMessage = useErrorMessage()
    const saveProfile = useSetMemberProfile(slug, member.id, token)
    const saved = payoutOf(member)
    const [editing, setEditing] = useState(!saved)
    const [payoutToken, setPayoutToken] = useState<PayoutToken>(saved?.token ?? 'USDT')
    const [network, setNetwork] = useState<PayoutNetwork>(saved?.network ?? DEFAULT_PAYOUT_NETWORK)
    const [address, setAddress] = useState(saved?.address ?? '')
    const [invalid, setInvalid] = useState(false)

    useEffect(() => {
        setEditing(!saved)
        // Only a change of the saved address resets the form; typing must not.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [saved?.address])

    const save = () => {
        if (!normalizePayoutAddress(network, address)) {
            setInvalid(true)
            return
        }
        setInvalid(false)
        saveProfile.mutate(
            { payout: { token: payoutToken, network, address } },
            {
                onSuccess: () => {
                    setEditing(false)
                    toast.success(t('saved'), { duration: TOAST_MS.default })
                },
                onError: (error) => toast.error(errorMessage(error, t('failed')), { duration: TOAST_MS.actionable }),
            }
        )
    }

    const clear = () =>
        saveProfile.mutate(
            { payout: null },
            {
                onSuccess: () => {
                    setAddress('')
                    setEditing(true)
                },
                onError: (error) => toast.error(errorMessage(error, t('failed')), { duration: TOAST_MS.actionable }),
            }
        )

    if (saved && !editing) {
        return (
            <div className="grid gap-2">
                <PayoutCard payout={saved} name={member.name} />
                <div className="flex gap-2">
                    <Button
                        variant="stroke"
                        width="auto"
                        className="flex-1 justify-center text-sm"
                        onClick={() => setEditing(true)}
                    >
                        {t('edit')}
                    </Button>
                    <Button
                        variant="stroke"
                        width="auto"
                        className="flex-1 justify-center text-sm"
                        onClick={clear}
                        loading={saveProfile.isPending}
                    >
                        {t('remove')}
                    </Button>
                </div>
            </div>
        )
    }

    const pill = (active: boolean) =>
        cn(
            'rounded-full border px-3 py-1.5 text-sm font-bold transition-colors',
            active ? 'border-n-1 bg-primary-1 text-n-1' : 'border-[#DCC5B4] bg-white text-grey-1'
        )

    return (
        <div className="grid gap-3" data-testid="payout-editor">
            <p className="text-sm text-grey-1">{t('walletHint')}</p>
            <div>
                <span className="text-h8 uppercase tracking-wide text-grey-1">{t('token')}</span>
                <div className="mt-1 flex gap-2" role="radiogroup" aria-label={t('token')}>
                    {PAYOUT_TOKENS.map((option) => (
                        <button
                            key={option}
                            type="button"
                            role="radio"
                            aria-checked={payoutToken === option}
                            className={pill(payoutToken === option)}
                            onClick={() => setPayoutToken(option)}
                        >
                            {option}
                        </button>
                    ))}
                </div>
            </div>
            <div>
                <span className="text-h8 uppercase tracking-wide text-grey-1">{t('network')}</span>
                <div className="mt-1 flex flex-wrap gap-2" role="radiogroup" aria-label={t('network')}>
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
            </div>
            <label className="grid gap-1">
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
                    data-testid="payout-address"
                />
                {invalid && (
                    <span role="alert" className="text-sm font-bold text-error">
                        {t('addressInvalid', { network: PAYOUT_NETWORKS[network].label })}
                    </span>
                )}
            </label>
            <div className="flex gap-2">
                {saved && (
                    <Button
                        variant="stroke"
                        width="auto"
                        className="flex-1 justify-center"
                        onClick={() => setEditing(false)}
                    >
                        {t('cancel')}
                    </Button>
                )}
                <Button
                    variant="primary"
                    width="auto"
                    className="flex-1 justify-center"
                    onClick={save}
                    loading={saveProfile.isPending}
                    disabled={address.trim().length === 0}
                    data-testid="save-payout"
                >
                    {t('save')}
                </Button>
            </div>
        </div>
    )
}

/**
 * The profile part of a member's sheet: the honored-guest switch (anyone may flip it) and the
 * wallet (only its owner edits it; everybody else sees it read-only).
 */
export function MemberProfile({
    member,
    slug,
    token,
    isMe,
}: {
    member: ApiMember
    slug: string
    token?: string | null
    isMe: boolean
}) {
    const t = useTranslations('room.profile')
    const errorMessage = useErrorMessage()
    const saveProfile = useSetMemberProfile(slug, member.id, token)
    const payout = payoutOf(member)

    return (
        <div className="mt-6 grid gap-6">
            <section className="grid gap-2">
                <h3 className="flex items-center gap-2 text-h7">
                    <Icon name="wallet" size={18} />
                    {isMe ? t('myWallet') : t('theirWallet', { name: member.name })}
                </h3>
                {isMe ? (
                    <PayoutEditor member={member} slug={slug} token={token} />
                ) : payout ? (
                    <PayoutCard payout={payout} name={member.name} />
                ) : (
                    <p className="text-sm text-grey-1">{t('noWallet', { name: member.name })}</p>
                )}
            </section>
            <section className="grid gap-2">
                <SettingToggle
                    label={t('honoredGuest')}
                    hint={t('honoredGuestHint', { name: member.name })}
                    checked={member.honoredGuest === true}
                    loading={saveProfile.isPending}
                    onChange={(next) =>
                        saveProfile.mutate(
                            { honoredGuest: next },
                            {
                                onError: (error) =>
                                    toast.error(errorMessage(error, t('failed')), { duration: TOAST_MS.actionable }),
                            }
                        )
                    }
                    testId="honored-guest-toggle"
                />
            </section>
        </div>
    )
}

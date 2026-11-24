'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { QRCodeSVG } from 'qrcode.react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/Button'
import { Icon } from '@/components/ui/Icon'
import { SettingToggle } from '@/components/ui/SettingToggle'
import type { ApiMember } from '@/lib/api-types'
import { copyText } from '@/lib/clipboard'
import { useErrorMessage } from '@/lib/error-messages'
import { hasPaymentMethod, isCbu, PAYOUT_NETWORKS, paymentMethodsOf, type PaymentMethods } from '@/lib/payout'
import { useSetMemberProfile } from '@/lib/queries/members-settings'
import { TOAST_MS } from '@/lib/toasts'

function CopyRow({ label, value, testId }: { label: string; value: string; testId: string }) {
    const t = useTranslations('room.profile')
    const copy = async () => {
        const ok = await copyText(value)
        if (ok) toast.success(t('copiedLabel', { label }), { duration: TOAST_MS.default })
    }
    return (
        <div className="flex min-w-0 items-center gap-2" data-testid={testId}>
            <span className="min-w-0 flex-1">
                <span className="block text-xs text-grey-1">{label}</span>
                <span className="block truncate font-mono text-sm font-bold" title={value}>
                    {value}
                </span>
            </span>
            <Button variant="stroke" size="small" width="auto" icon="copy" onClick={copy}>
                {t('copy')}
            </Button>
        </div>
    )
}

/**
 * Every way to send a member their money (bank alias or CBU/CVU, Lemon tag, wallet), each with a
 * one-tap copy. Read-only: Tribu never sends anything from here; the payer uses their own bank,
 * Lemon or wallet, then marks it paid.
 */
export function PaymentMethodsCard({ methods, name }: { methods: PaymentMethods; name: string }) {
    const t = useTranslations('room.profile')
    const [showQr, setShowQr] = useState(false)
    const { bank, lemonTag, crypto } = methods
    if (!hasPaymentMethod(methods)) return null

    return (
        <div
            className="flex min-w-0 flex-col gap-3 rounded-sm border border-n-1 bg-white p-3"
            data-testid="payment-methods"
        >
            <p className="text-sm text-grey-1">{t('payTo', { name })}</p>
            {bank && (
                <CopyRow label={isCbu(bank) ? t('cbuLabel') : t('aliasLabel')} value={bank} testId="payment-bank" />
            )}
            {lemonTag && <CopyRow label={t('lemonLabel')} value={`@${lemonTag}`} testId="payment-lemon" />}
            {crypto && (
                <div className="flex min-w-0 flex-col gap-2" data-testid="payout-card">
                    <CopyRow
                        label={t('cryptoLabel', {
                            token: crypto.token,
                            network: PAYOUT_NETWORKS[crypto.network].label,
                        })}
                        value={crypto.address}
                        testId="payment-crypto"
                    />
                    <button
                        type="button"
                        className="self-start text-sm font-bold underline"
                        onClick={() => setShowQr((open) => !open)}
                    >
                        {showQr ? t('hideQr') : t('showQr')}
                    </button>
                    {showQr && (
                        <div className="flex justify-center rounded-sm bg-white p-2">
                            <QRCodeSVG value={crypto.address} size={168} marginSize={1} />
                        </div>
                    )}
                    <p className="text-xs text-grey-1">
                        {t('networkWarning', { network: PAYOUT_NETWORKS[crypto.network].label })}
                    </p>
                </div>
            )}
        </div>
    )
}

/**
 * The profile part of a member's sheet: how to pay them (edited only by the member, in "Yo") and
 * the honored-guest switch (anyone may flip it).
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
    const methods = paymentMethodsOf(member)

    return (
        <div className="mt-6 grid gap-6">
            <section className="grid gap-2">
                <h3 className="flex items-center gap-2 text-h7">
                    <Icon name="wallet" size={18} />
                    {isMe ? t('myMethods') : t('theirMethods', { name: member.name })}
                </h3>
                {hasPaymentMethod(methods) ? (
                    <PaymentMethodsCard methods={methods} name={member.name} />
                ) : (
                    <p className="text-sm text-grey-1">
                        {isMe ? t('noMethodsMine') : t('noMethods', { name: member.name })}
                    </p>
                )}
                {isMe && (
                    <Link href="/yo" className="text-sm font-bold underline" data-testid="edit-methods">
                        {hasPaymentMethod(methods) ? t('editInProfile') : t('addInProfile')}
                    </Link>
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

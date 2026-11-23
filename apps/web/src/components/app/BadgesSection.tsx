'use client'

import { useEffect, useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { useInLemon } from '@/components/lemon/LemonProvider'
import { Doodle } from '@/components/ui/Doodle'
import type { DoodleName } from '@/components/ui/doodles'
import { api } from '@/lib/api'
import { BADGES, myBadges, type BadgeId } from '@/lib/badges'
import { cn } from '@/lib/cn'
import { useErrorMessage } from '@/lib/error-messages'
import { readIdentity } from '@/lib/identity'
import { mintBadge } from '@/lib/lemon/client'
import type { MyRoom } from '@/lib/my-overview'
import { TOAST_MS } from '@/lib/toasts'

const DOODLES: Record<BadgeId, DoodleName> = {
    'fast-payer': 'expense_clock',
    'crypto-payer': 'expense_bitcoin',
    keeper: 'expense_key_round',
    rounder: 'expense_coins',
    'bet-winner': 'expense_handshake',
    'roulette-pick': 'expense_dices',
    'pot-goal': 'expense_goal',
}

const MINTED_KEY = 'tribu:insignias-guardadas'

function readMinted(): Set<string> {
    try {
        return new Set(JSON.parse(window.localStorage.getItem(MINTED_KEY) ?? '[]') as string[])
    } catch {
        return new Set()
    }
}

function rememberMinted(ids: Set<string>) {
    try {
        window.localStorage.setItem(MINTED_KEY, JSON.stringify([...ids]))
    } catch {
        // The badge is in the wallet either way; this only hides the button.
    }
}

/**
 * Insignias: one card per badge, earned or not. Inside Lemon, an earned badge can be kept as a free
 * NFT in the wallet linked to that tribu, once the badge contract is deployed and configured.
 */
export function BadgesSection({ rooms }: { rooms: readonly MyRoom[] }) {
    const t = useTranslations('appShell.me.badges')
    const errorMessage = useErrorMessage()
    const inLemon = useInLemon()
    const earned = useMemo(() => myBadges(rooms), [rooms])
    const [minted, setMinted] = useState<Set<string>>(() => new Set())
    useEffect(() => setMinted(readMinted()), [])
    const [busy, setBusy] = useState<BadgeId | null>(null)
    const mintable = inLemon && !!process.env.NEXT_PUBLIC_TRIBU_BADGES_ADDRESS

    const keep = async (badge: BadgeId) => {
        const slug = earned.get(badge)
        if (!slug || busy) return
        setBusy(badge)
        try {
            const voucher = await api.badgeVoucher(slug, badge, readIdentity(slug)?.token)
            const result = await mintBadge({ ...voucher, title: t('mintTitle', { name: t(`items.${badge}.name`) }) })
            if (result.status === 'sent') {
                const next = new Set(minted).add(badge)
                setMinted(next)
                rememberMinted(next)
                toast(t('minted'), { duration: TOAST_MS.actionable })
            } else if (result.status === 'failed') {
                toast.error(t('mintFailed'), { duration: TOAST_MS.actionable })
            }
        } catch (error) {
            toast.error(errorMessage(error), { duration: TOAST_MS.actionable })
        } finally {
            setBusy(null)
        }
    }

    return (
        <section data-testid="me-badges">
            <h2 className="text-h6">{t('title')}</h2>
            <p className="mt-1 text-sm text-grey-1">{t('count', { earned: earned.size, total: BADGES.length })}</p>
            <ul className="mt-3 grid grid-cols-2 gap-2">
                {BADGES.map((badge) => {
                    const has = earned.has(badge.id)
                    return (
                        <li
                            key={badge.id}
                            className={cn(
                                'relative flex flex-col gap-1 rounded-sm border border-n-1 p-3',
                                has ? 'shadow-4 bg-white' : 'border-dashed bg-white/40 text-grey-1'
                            )}
                            data-testid={`badge-${badge.id}`}
                        >
                            <span className="absolute right-2 top-2 font-mono text-xs text-grey-1">
                                #{String(badge.tokenId).padStart(2, '0')}
                            </span>
                            <span
                                className={cn(
                                    'flex size-11 items-center justify-center rounded-full border border-n-1',
                                    has ? 'bg-secondary-1/40 text-n-1' : 'bg-white opacity-50'
                                )}
                            >
                                <Doodle name={DOODLES[badge.id]} size={24} weight={1.8} />
                            </span>
                            <span className={cn('text-h8 leading-tight', has && 'text-n-1')}>
                                {t(`items.${badge.id}.name`)}
                            </span>
                            <span className="text-xs leading-snug">
                                {has ? t(`items.${badge.id}.earned`) : t(`items.${badge.id}.how`)}
                            </span>
                            {has && mintable && !minted.has(badge.id) && (
                                <button
                                    type="button"
                                    onClick={() => void keep(badge.id)}
                                    disabled={busy !== null}
                                    className="mt-1 self-start rounded-full border border-n-1 bg-primary-1 px-2.5 py-1 text-xs font-bold disabled:opacity-50"
                                    data-testid="badge-mint"
                                >
                                    {busy === badge.id ? t('minting') : t('mint')}
                                </button>
                            )}
                            {has && minted.has(badge.id) && (
                                <span className="mt-1 text-xs font-bold text-n-1">{t('inWallet')}</span>
                            )}
                        </li>
                    )
                })}
            </ul>
        </section>
    )
}

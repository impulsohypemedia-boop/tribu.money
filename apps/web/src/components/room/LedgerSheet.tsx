'use client'

import { useLocale, useTranslations } from 'next-intl'
import { Button } from '@/components/ui/Button'
import { CloseButton } from '@/components/ui/CloseButton'
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/Drawer'
import { DrawerBody } from '@/components/ui/DrawerLayout'
import type { ApiLedgerEntry, RoomState } from '@/lib/api-types'
import { cn } from '@/lib/cn'
import { useRoomLedger } from '@/lib/queries'
import { Money } from './Money'

/** The amount an entry moved: what the payer put in, what was paid, or what went into the pot. */
const movedMinor = (entry: ApiLedgerEntry): string => {
    const first = entry.postings[0]?.amountMinor ?? '0'
    const value = BigInt(first)
    return (value < 0n ? -value : value).toString()
}

/**
 * "Movimientos": the tribu's book of account, newest first. Nothing in it is ever edited or
 * removed; a corrected or deleted expense shows up as "Se anuló" next to its new version.
 */
export function LedgerSheet({
    open,
    onClose,
    slug,
    state,
}: {
    open: boolean
    onClose: () => void
    slug: string
    state: RoomState
}) {
    const t = useTranslations('room.ledger')
    const locale = useLocale()
    const ledger = useRoomLedger(slug, open)
    const entries = ledger.data?.pages.flatMap((page) => page.entries) ?? []

    const memberName = (id: string | null | undefined) =>
        state.members.find((member) => member.id === id)?.name ?? t('someone')
    const potName = (id: string | null | undefined, fallback: string | null) =>
        (state.pots ?? []).find((pot) => pot.id === id)?.name ?? fallback ?? t('vaquita')

    const titleOf = (entry: ApiLedgerEntry): string => {
        const { detail } = entry
        if (entry.sourceType === 'expense') return entry.description ?? t('expense')
        if (entry.sourceType === 'settlement') {
            const names = { from: memberName(detail.fromId), to: memberName(detail.toId) }
            return detail.method === 'pot' ? t('paymentForPot', names) : t('payment', names)
        }
        return t('intoPot', { name: memberName(detail.memberId), pot: potName(detail.potId, entry.description) })
    }

    const subtitleOf = (entry: ApiLedgerEntry): string | null => {
        if (entry.sourceType === 'expense') {
            const paidBy = memberName(entry.detail.paidById)
            return entry.detail.potId && entry.postings.some((posting) => posting.accountType === 'pot')
                ? t('paidFromPot', { name: paidBy })
                : t('paidBy', { name: paidBy })
        }
        if (entry.sourceType === 'pot_contribution') return t('heldBy', { name: memberName(entry.detail.keeperId) })
        return null
    }

    const accountLabel = (posting: ApiLedgerEntry['postings'][number]) =>
        posting.accountType === 'pot' ? potName(posting.accountId, null) : memberName(posting.accountId)

    /** Net per account for the "how it moved" line. The keeper mirror is left out: it repeats the pot. */
    const linesOf = (entry: ApiLedgerEntry) => {
        const net = new Map<string, { label: string; amount: bigint }>()
        for (const posting of entry.postings) {
            if (posting.accountType === 'keeper') continue
            const key = `${posting.accountType}:${posting.accountId}`
            const current = net.get(key) ?? { label: accountLabel(posting), amount: 0n }
            current.amount += BigInt(posting.amountMinor)
            net.set(key, current)
        }
        return [...net.values()].filter((line) => line.amount !== 0n)
    }

    return (
        <Drawer open={open} onOpenChange={(next) => !next && onClose()}>
            <DrawerContent data-testid="ledger-sheet">
                <DrawerHeader>
                    <div className="flex items-end justify-between gap-3">
                        <DrawerTitle className="text-h5">{t('title')}</DrawerTitle>
                        <CloseButton onClick={onClose} label={t('close')} data-testid="close-ledger-sheet" />
                    </div>
                </DrawerHeader>
                <DrawerBody>
                    <p className="text-sm text-grey-1">{t('intro')}</p>
                    {ledger.isPending ? (
                        <p className="text-sm text-grey-1">{t('loading')}</p>
                    ) : ledger.isError ? (
                        <div className="flex flex-col gap-3" role="alert">
                            <p className="text-sm font-bold text-error">{t('failed')}</p>
                            <Button variant="stroke" onClick={() => void ledger.refetch()} className="justify-center">
                                {t('retry')}
                            </Button>
                        </div>
                    ) : entries.length === 0 ? (
                        <p className="text-sm text-grey-1">{t('empty')}</p>
                    ) : (
                        <ol className="flex flex-col gap-3" data-testid="ledger-list">
                            {entries.map((entry) => {
                                const reversal = entry.kind === 'reversal'
                                const subtitle = subtitleOf(entry)
                                const lines = linesOf(entry)
                                return (
                                    <li
                                        key={entry.id}
                                        className={cn(
                                            'rounded-sm border border-n-1 bg-white p-3',
                                            reversal && 'bg-background'
                                        )}
                                        data-testid="ledger-entry"
                                    >
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="min-w-0">
                                                <time className="text-xs text-grey-1" dateTime={entry.createdAt}>
                                                    {new Intl.DateTimeFormat(locale, {
                                                        dateStyle: 'medium',
                                                        timeStyle: 'short',
                                                    }).format(new Date(reversal ? entry.createdAt : entry.occurredAt))}
                                                </time>
                                                <p className="mt-1 break-words text-sm font-bold">
                                                    {reversal
                                                        ? t('reversed', { title: titleOf(entry) })
                                                        : titleOf(entry)}
                                                </p>
                                                {subtitle && !reversal && (
                                                    <p className="text-xs text-grey-1">{subtitle}</p>
                                                )}
                                            </div>
                                            <Money
                                                minor={movedMinor(entry)}
                                                currency={entry.currency}
                                                className={cn('shrink-0 text-sm font-bold', reversal && 'line-through')}
                                            />
                                        </div>
                                        {lines.length > 0 && (
                                            <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-grey-1">
                                                {lines.map((line) => (
                                                    <li key={line.label}>
                                                        {line.label}{' '}
                                                        <span
                                                            className={
                                                                line.amount > 0n
                                                                    ? 'text-balance-incoming-accent'
                                                                    : undefined
                                                            }
                                                        >
                                                            {line.amount > 0n ? '+' : '−'}
                                                            <Money
                                                                minor={(line.amount < 0n
                                                                    ? -line.amount
                                                                    : line.amount
                                                                ).toString()}
                                                                currency={entry.currency}
                                                            />
                                                        </span>
                                                    </li>
                                                ))}
                                            </ul>
                                        )}
                                    </li>
                                )
                            })}
                        </ol>
                    )}
                    {ledger.hasNextPage && (
                        <Button
                            variant="stroke"
                            onClick={() => void ledger.fetchNextPage()}
                            loading={ledger.isFetchingNextPage}
                            className="justify-center"
                        >
                            {t('loadOlder')}
                        </Button>
                    )}
                </DrawerBody>
            </DrawerContent>
        </Drawer>
    )
}

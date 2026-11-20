'use client'

import { useEffect, useMemo, useState } from 'react'
import Image from 'next/image'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { tribuFestejo } from '@/assets/mascot'
import { CloseButton } from '@/components/ui/CloseButton'
import { Doodle } from '@/components/ui/Doodle'
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/Drawer'
import { DrawerBody } from '@/components/ui/DrawerLayout'
import { Icon } from '@/components/ui/Icon'
import type { DoodleName } from '@/components/ui/doodles'
import type { RoomState } from '@/lib/api-types'
import { cn } from '@/lib/cn'
import { markSeen, readSeen } from '@/lib/achievement-storage'
import { milestoneSeenId, tribeMilestones, type TribeMilestoneId } from '@/lib/tribe-milestones'
import { TOAST_MS } from '@/lib/toasts'

const ART: Record<TribeMilestoneId, DoodleName> = {
    'first-expense': 'iconreceipt',
    'expenses-10': 'party',
    'everyone-paid': 'iconusers',
    'first-payment': 'iconhandcoins',
    'all-square': 'iconcheck',
    'three-currencies': 'globe',
    'pot-goal': 'gift',
    'expenses-50': 'reactionfire',
}

/**
 * Logros de la tribu: a small card with how many milestones the group has reached, a sheet with
 * the full list, and a toast the moment a new one lands on this device.
 */
export function TribeMilestones({ slug, state }: { slug: string; state: RoomState }) {
    const t = useTranslations('room.milestones')
    const [open, setOpen] = useState(false)
    const milestones = useMemo(() => tribeMilestones(state), [state])
    const reached = milestones.filter((milestone) => milestone.reached)

    useEffect(() => {
        const seen = readSeen(slug)
        const fresh = reached.filter((milestone) => !seen.has(milestoneSeenId(milestone.id)))
        if (fresh.length === 0) return
        markSeen(
            slug,
            fresh.map((milestone) => milestoneSeenId(milestone.id))
        )
        // A room opened for the first time on this phone already has its history: celebrate the
        // newest step only, and let the rest wait quietly in the list.
        const newest = fresh[fresh.length - 1]
        toast(t('unlocked', { title: t(`items.${newest.id}.title`) }), {
            duration: TOAST_MS.state,
            icon: <Doodle name={ART[newest.id]} size={20} weight={1.8} />,
        })
        // Only a change in what is reached should run this, not every new state object.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [slug, reached.map((milestone) => milestone.id).join()])

    if (reached.length === 0) return null

    return (
        <>
            <button
                type="button"
                onClick={() => setOpen(true)}
                className="shadow-4 mb-4 flex w-full items-center gap-3 rounded-sm border border-n-1 bg-white p-3 text-left transition-transform active:translate-y-[2px]"
                data-testid="tribe-milestones-card"
            >
                <Image src={tribuFestejo} alt="" unoptimized className="size-10 shrink-0 object-contain" />
                <span className="min-w-0 flex-1">
                    <span className="block text-h8">{t('cardTitle')}</span>
                    <span className="block truncate text-sm text-grey-1">
                        {t('cardLine', { reached: reached.length, total: milestones.length })}
                    </span>
                </span>
                <Icon name="chevron-right" size={18} className="shrink-0 text-grey-1" />
            </button>

            <Drawer open={open} onOpenChange={(next) => !next && setOpen(false)}>
                <DrawerContent data-testid="tribe-milestones">
                    <DrawerHeader className="flex flex-row items-end justify-between">
                        <DrawerTitle className="text-h5">{t('title')}</DrawerTitle>
                        <CloseButton onClick={() => setOpen(false)} label={t('close')} />
                    </DrawerHeader>
                    <DrawerBody>
                        <p className="text-sm text-grey-1">{t('intro')}</p>
                        <ul className="mt-4 grid grid-cols-2 gap-3">
                            {milestones.map((milestone) => (
                                <li
                                    key={milestone.id}
                                    data-testid="tribe-milestone"
                                    data-reached={milestone.reached}
                                    className={cn(
                                        'flex flex-col items-center gap-2 rounded-sm border p-3 text-center',
                                        milestone.reached
                                            ? 'shadow-2 border-n-1 bg-primary-3/50'
                                            : 'border-dashed border-grey-2 bg-white text-grey-1'
                                    )}
                                >
                                    <span
                                        className={cn(
                                            'flex size-12 items-center justify-center rounded-full border',
                                            milestone.reached ? 'border-n-1 bg-white' : 'border-grey-2 opacity-50'
                                        )}
                                    >
                                        <Doodle name={ART[milestone.id]} size={26} weight={1.7} />
                                    </span>
                                    <span className={cn('text-h8', !milestone.reached && 'text-grey-1')}>
                                        {t(`items.${milestone.id}.title`)}
                                    </span>
                                    <span className="text-xs text-grey-1">{t(`items.${milestone.id}.body`)}</span>
                                </li>
                            ))}
                        </ul>
                    </DrawerBody>
                </DrawerContent>
            </Drawer>
        </>
    )
}

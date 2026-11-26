'use client'

import { useMemo } from 'react'
import { useTranslations } from 'next-intl'
import { CloseButton } from '@/components/ui/CloseButton'
import { Doodle } from '@/components/ui/Doodle'
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/Drawer'
import { DrawerBody } from '@/components/ui/DrawerLayout'
import type { DoodleName } from '@/components/ui/doodles'
import type { RoomState } from '@/lib/api-types'
import { cn } from '@/lib/cn'
import { tribeMilestones, type TribeMilestoneId } from '@/lib/tribe-milestones'

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

/** "2 de 8" for the settings row that opens the sheet. */
export function useTribeMilestoneCount(state: RoomState): { reached: number; total: number } {
    return useMemo(() => {
        const milestones = tribeMilestones(state)
        return { reached: milestones.filter((milestone) => milestone.reached).length, total: milestones.length }
    }, [state])
}

/**
 * Logros de la tribu: the full list of group milestones. It lives behind a row in the tribu's
 * settings, not on the room screen: the room is for the money, and a badge shelf between the
 * balances and the expenses pushed the expenses down for something nobody came to do.
 */
export function TribeMilestonesSheet({
    open,
    onClose,
    state,
}: {
    open: boolean
    onClose: () => void
    state: RoomState
}) {
    const t = useTranslations('room.milestones')
    const milestones = useMemo(() => tribeMilestones(state), [state])

    return (
        <Drawer open={open} onOpenChange={(next) => !next && onClose()}>
            <DrawerContent data-testid="tribe-milestones">
                <DrawerHeader className="flex flex-row items-end justify-between">
                    <DrawerTitle className="text-h5">{t('title')}</DrawerTitle>
                    <CloseButton onClick={onClose} label={t('close')} />
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
    )
}

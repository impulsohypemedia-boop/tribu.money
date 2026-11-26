'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { CloseButton } from '@/components/ui/CloseButton'
import { Doodle } from '@/components/ui/Doodle'
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/Drawer'
import { DrawerBody } from '@/components/ui/DrawerLayout'
import type { DoodleName } from '@/components/ui/doodles'
import { Icon } from '@/components/ui/Icon'
import { RoomEmblem } from '@/components/room/RoomEmblem'
import { readRecentRooms, type RecentRoom } from '@/lib/recent-rooms'
import { themeFor } from '@/lib/themes'

type Choice = 'expense' | 'fixed' | 'vaquita' | 'tribu' | 'pareja'

const CHOICES: { id: Choice; doodle: DoodleName }[] = [
    { id: 'expense', doodle: 'iconreceipt' },
    { id: 'fixed', doodle: 'iconcalendar' },
    { id: 'vaquita', doodle: 'gift' },
    { id: 'tribu', doodle: 'iconusers' },
    { id: 'pareja', doodle: 'expense_house_heart' },
]

/**
 * One place to load anything. An expense or a monthly expense always belongs to a tribu, so
 * those two ask which one first (and skip the question when there is only one).
 */
export function AddAnythingSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
    const t = useTranslations('appShell.add')
    const router = useRouter()
    const [picking, setPicking] = useState<'expense' | 'fixed' | null>(null)
    const [tribus, setTribus] = useState<RecentRoom[]>([])

    useEffect(() => {
        if (!open) return
        setPicking(null)
        setTribus(readRecentRooms().filter((room) => room.kind !== 'vaquita'))
    }, [open])

    const go = (href: string) => {
        onClose()
        router.push(href)
    }

    const roomHref = (slug: string, kind: 'expense' | 'fixed') =>
        `/r/${encodeURIComponent(slug)}?add=1${kind === 'fixed' ? '&fijo=1' : ''}`

    const choose = (choice: Choice) => {
        if (choice === 'vaquita') return go('/new?tipo=vaquita')
        if (choice === 'tribu') return go('/new')
        if (choice === 'pareja') return go('/new?tipo=pareja')
        if (tribus.length === 0) return go('/new')
        if (tribus.length === 1) return go(roomHref(tribus[0].slug, choice))
        setPicking(choice)
    }

    return (
        <Drawer open={open} onOpenChange={(next) => !next && onClose()}>
            <DrawerContent data-testid="add-anything">
                <DrawerHeader className="flex flex-row items-end justify-between">
                    <DrawerTitle className="text-h5">{picking ? t('whichTribu') : t('title')}</DrawerTitle>
                    <CloseButton onClick={onClose} label={t('close')} />
                </DrawerHeader>
                <DrawerBody>
                    {picking === null ? (
                        <ul className="grid gap-3">
                            {CHOICES.map((choice) => (
                                <li key={choice.id}>
                                    <button
                                        type="button"
                                        onClick={() => choose(choice.id)}
                                        data-testid={`add-${choice.id}`}
                                        className="shadow-4 flex w-full items-center gap-3 rounded-sm border border-n-1 bg-white p-3 text-left transition-transform active:translate-y-[2px]"
                                    >
                                        <span className="flex size-11 shrink-0 items-center justify-center rounded-full border border-n-1 bg-primary-3">
                                            <Doodle name={choice.doodle} size={24} weight={1.8} />
                                        </span>
                                        <span className="min-w-0 flex-1">
                                            <span className="block text-h7">{t(`${choice.id}.title`)}</span>
                                            <span className="block text-sm text-grey-1">
                                                {(choice.id === 'expense' || choice.id === 'fixed') &&
                                                tribus.length === 0
                                                    ? t('needTribu')
                                                    : t(`${choice.id}.hint`)}
                                            </span>
                                        </span>
                                        <Icon name="chevron-right" size={18} className="shrink-0 text-grey-1" />
                                    </button>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <ul className="grid gap-2" data-testid="add-pick-tribu">
                            {tribus.map((room) => (
                                <li key={room.slug}>
                                    <button
                                        type="button"
                                        onClick={() => go(roomHref(room.slug, picking))}
                                        className="flex w-full items-center gap-3 rounded-sm border border-n-1 bg-white p-3 text-left"
                                    >
                                        <span
                                            style={
                                                room.theme ? { backgroundColor: themeFor(room.theme).field } : undefined
                                            }
                                            className="flex size-10 shrink-0 items-center justify-center rounded-sm border border-n-1 bg-primary-3"
                                        >
                                            <RoomEmblem value={room.emoji} name={room.name} size={26} />
                                        </span>
                                        <span className="min-w-0 flex-1 truncate text-h7">{room.name}</span>
                                        <Icon name="chevron-right" size={18} className="shrink-0 text-grey-1" />
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}
                </DrawerBody>
            </DrawerContent>
        </Drawer>
    )
}

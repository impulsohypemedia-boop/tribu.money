'use client'

import { useMemo } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { tribuPensando } from '@/assets/mascot'
import { RoomEmblem } from '@/components/room/RoomEmblem'
import { Doodle } from '@/components/ui/Doodle'
import { Icon } from '@/components/ui/Icon'
import { buttonClassName } from '@/components/ui/button-style'
import { myPots } from '@/lib/my-overview'
import { useMyRooms } from '@/lib/queries/my-rooms'
import { useCurrencies } from '@/lib/queries/reads'
import { PotProgressCard } from './HomeScreen'

/** Vaquitas: every open pot with its progress, then the vaquitas that already closed. */
export function VaquitasScreen() {
    const t = useTranslations('appShell.vaquitas')
    const { recent, rooms, loading, ready } = useMyRooms()
    const { data: catalog } = useCurrencies()
    const pots = useMemo(() => myPots(rooms), [rooms])
    const openSlugs = new Set(pots.map((pot) => pot.slug))
    const closed = recent.filter(
        (room) =>
            room.kind === 'vaquita' && !openSlugs.has(room.slug) && rooms.some((loaded) => loaded.slug === room.slug)
    )

    return (
        <div className="px-5 pt-5" data-testid="vaquitas">
            <Link
                href="/new?tipo=vaquita"
                data-testid="vaquitas-new"
                className={buttonClassName({ shadowSize: '4', className: 'justify-center text-h6 no-underline' })}
            >
                <Doodle name="gift" size={22} weight={2} />
                {t('new')}
            </Link>
            <p className="mt-3 text-sm text-grey-1">{t('hint')}</p>

            {pots.length > 0 ? (
                <div className="mt-6 grid gap-3">
                    {pots.map((pot) => (
                        <PotProgressCard key={`${pot.slug}-${pot.pot.id}`} pot={pot} catalog={catalog} />
                    ))}
                </div>
            ) : (
                ready &&
                !loading && (
                    <div className="mt-10 flex flex-col items-center text-center" data-testid="vaquitas-empty">
                        <Image src={tribuPensando} alt="" unoptimized className="size-24 object-contain" />
                        <p className="mt-3 text-h6">{t('emptyTitle')}</p>
                        <p className="mt-1 max-w-xs text-sm text-grey-1">{t('emptyBody')}</p>
                    </div>
                )
            )}

            {closed.length > 0 && (
                <>
                    <h2 className="mb-3 mt-8 text-h6">{t('closedTitle')}</h2>
                    <ul className="grid gap-2">
                        {closed.map((room) => (
                            <li key={room.slug}>
                                <Link
                                    href={`/r/${encodeURIComponent(room.slug)}`}
                                    className="flex items-center gap-3 rounded-sm border border-n-1 bg-white p-3 text-grey-1 no-underline"
                                >
                                    <span className="flex size-10 shrink-0 items-center justify-center rounded-sm border border-n-1 bg-grey-2">
                                        <RoomEmblem value={room.emoji} name={room.name} size={26} />
                                    </span>
                                    <span className="min-w-0 flex-1 truncate text-h7">{room.name}</span>
                                    <Icon name="chevron-right" size={18} className="shrink-0" />
                                </Link>
                            </li>
                        ))}
                    </ul>
                </>
            )}
        </div>
    )
}

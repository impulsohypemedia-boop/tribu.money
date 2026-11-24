'use client'

import { useMemo } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { tribuFestejo, tribuHola } from '@/assets/mascot'
import { Money } from '@/components/room/Money'
import { RoomEmblem } from '@/components/room/RoomEmblem'
import { Doodle } from '@/components/ui/Doodle'
import type { DoodleName } from '@/components/ui/doodles'
import { Icon } from '@/components/ui/Icon'
import { buttonClassName } from '@/components/ui/button-style'
import type { CurrencyInfo } from '@/lib/api-types'
import { myPositions, myPots, upcomingFixed, type MyPot } from '@/lib/my-overview'
import { useMyRooms } from '@/lib/queries/my-rooms'
import { useCurrencies } from '@/lib/queries/reads'
import { themeFor } from '@/lib/themes'

const roomHref = (slug: string) => `/r/${encodeURIComponent(slug)}`

/** What a tribu's account does, named on the empty Inicio with the landing's own words. */
const EMPTY_FEATURES: { key: 'record' | 'settle' | 'pool'; doodle: DoodleName }[] = [
    { key: 'record', doodle: 'tally' },
    { key: 'settle', doodle: 'swap' },
    { key: 'pool', doodle: 'gift' },
]

function SectionTitle({ title, href, more }: { title: string; href?: string; more?: string }) {
    return (
        <div className="mb-3 mt-7 flex items-baseline justify-between gap-3">
            <h2 className="text-h6">{title}</h2>
            {href && more && (
                <Link href={href} className="text-sm font-bold text-n-1 underline">
                    {more}
                </Link>
            )}
        </div>
    )
}

/** One vaquita's progress, shared by Inicio and Vaquitas. */
export function PotProgressCard({ pot, catalog }: { pot: MyPot; catalog?: readonly CurrencyInfo[] }) {
    const t = useTranslations('appShell.home')
    const pct = pot.summary.progressPct
    return (
        <Link
            href={roomHref(pot.slug)}
            data-testid="pot-progress"
            className="shadow-4 block rounded-sm border border-n-1 bg-white p-3 no-underline transition-transform active:translate-y-[2px]"
        >
            <span className="flex items-center gap-2">
                <Doodle name="gift" size={20} weight={1.8} />
                <span className="min-w-0 flex-1 truncate text-h8">{pot.pot.name}</span>
                <Money
                    minor={pot.summary.contributedMinor}
                    currency={pot.currency}
                    catalog={catalog}
                    className="text-h8"
                />
            </span>
            {pct !== null ? (
                <>
                    <span className="mt-2 block h-2.5 overflow-hidden rounded-full border border-n-1 bg-white">
                        <span
                            className={pct >= 100 ? 'block h-full bg-green-1' : 'block h-full bg-primary-1'}
                            style={{ width: `${Math.max(pct, 3)}%` }}
                        />
                    </span>
                    <span className="mt-1 block text-xs text-grey-1">
                        {pct >= 100
                            ? t('potReached')
                            : t.rich('potMissing', {
                                  pct,
                                  amount: () => (
                                      <Money
                                          minor={pot.summary.missingMinor ?? '0'}
                                          currency={pot.currency}
                                          catalog={catalog}
                                      />
                                  ),
                              })}
                    </span>
                </>
            ) : (
                <span className="mt-1 block text-xs text-grey-1">{t('potNoGoal')}</span>
            )}
        </Link>
    )
}

export function HomeScreen() {
    const t = useTranslations('appShell.home')
    const tFeatures = useTranslations('marketing.landingFeatures')
    const { recent, rooms, loading, ready } = useMyRooms()
    const { data: catalog } = useCurrencies()
    const positions = useMemo(() => myPositions(rooms), [rooms])
    const fixed = useMemo(() => upcomingFixed(rooms), [rooms])
    const pots = useMemo(() => myPots(rooms), [rooms])
    const tribus = recent.filter((room) => room.kind !== 'vaquita')
    const joinedAny = rooms.some((room) => room.meId)

    if (ready && recent.length === 0) {
        return (
            <section data-testid="home-empty" className="flex flex-col items-center px-5 pb-8 pt-6 text-center">
                <Image src={tribuHola} alt="" unoptimized className="h-24 w-24 object-contain" />
                <h2 className="mt-4 text-h4">{t('emptyTitle')}</h2>
                <p className="mt-2 max-w-xs text-grey-1">{t('emptyBody')}</p>
                <ul className="mt-5 grid w-full max-w-xs grid-cols-3 gap-2">
                    {EMPTY_FEATURES.map(({ key, doodle }) => (
                        <li
                            key={key}
                            className="flex flex-col items-center gap-2 rounded-sm border border-n-1/15 bg-white px-2 py-3"
                        >
                            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-3">
                                <Doodle name={doodle} size={20} weight={1.8} />
                            </span>
                            <span className="text-xs font-bold leading-4">{tFeatures(`${key}.title`)}</span>
                        </li>
                    ))}
                </ul>
                <div className="mt-6 grid w-full max-w-xs gap-3">
                    <Link
                        href="/new"
                        className={buttonClassName({ shadowSize: '4', className: 'justify-center no-underline' })}
                    >
                        {t('startTribu')}
                    </Link>
                    <Link
                        href="/new?tipo=vaquita"
                        className={buttonClassName({ variant: 'stroke', className: 'justify-center no-underline' })}
                    >
                        {t('startVaquita')}
                    </Link>
                </div>
            </section>
        )
    }

    const square = positions.totals.length === 0
    return (
        <div className="px-5 pt-5" data-testid="home">
            <section
                data-testid="home-balance"
                className="shadow-4 rounded-sm border border-n-1 bg-white p-4"
                aria-busy={loading}
            >
                {!ready || (loading && rooms.length === 0) ? (
                    <p className="py-4 text-center text-sm text-grey-1">{t('loading')}</p>
                ) : square ? (
                    <div className="flex items-center gap-3">
                        <Image src={tribuFestejo} alt="" unoptimized className="size-16 shrink-0 object-contain" />
                        <div>
                            <p className="text-h5">{joinedAny ? t('allSquare') : t('notJoined')}</p>
                            <p className="text-sm text-grey-1">{joinedAny ? t('allSquareHint') : t('notJoinedHint')}</p>
                        </div>
                    </div>
                ) : (
                    <div className="grid gap-3">
                        {positions.totals.map((total) => (
                            <div key={total.currency} className="grid gap-1">
                                {total.owedToMeMinor !== '0' && (
                                    <p className="flex items-baseline justify-between gap-3">
                                        <span className="text-grey-1">{t('owedToMe')}</span>
                                        <Money
                                            minor={total.owedToMeMinor}
                                            currency={total.currency}
                                            catalog={catalog}
                                            className="text-h4 text-balance-incoming-accent"
                                        />
                                    </p>
                                )}
                                {total.iOweMinor !== '0' && (
                                    <p className="flex items-baseline justify-between gap-3">
                                        <span className="text-grey-1">{t('iOwe')}</span>
                                        <Money
                                            minor={total.iOweMinor}
                                            currency={total.currency}
                                            catalog={catalog}
                                            className="text-h4"
                                        />
                                    </p>
                                )}
                            </div>
                        ))}
                        <ul className="grid gap-1 border-t border-dashed border-grey-2 pt-3">
                            {positions.rooms.slice(0, 4).map((room) => (
                                <li key={room.slug}>
                                    <Link
                                        href={roomHref(room.slug)}
                                        className="flex items-center justify-between gap-3 py-1 text-sm no-underline"
                                    >
                                        <span className="min-w-0 flex-1 truncate">{room.name}</span>
                                        <span
                                            className={
                                                room.netMinor.startsWith('-') ? '' : 'text-balance-incoming-accent'
                                            }
                                        >
                                            {room.netMinor.startsWith('-') ? t('youPass') : t('youGet')}{' '}
                                            <Money
                                                minor={room.netMinor}
                                                currency={room.currency}
                                                catalog={catalog}
                                                absolute
                                                className="font-bold"
                                            />
                                        </span>
                                        <Icon name="chevron-right" size={16} className="shrink-0 text-grey-1" />
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}
            </section>

            {fixed.length > 0 && (
                <>
                    <SectionTitle title={t('fixedTitle')} />
                    <ul className="grid gap-2" data-testid="home-fixed">
                        {fixed.slice(0, 5).map((entry) => (
                            <li key={`${entry.slug}-${entry.item.id}`}>
                                <Link
                                    href={roomHref(entry.slug)}
                                    className="flex items-center gap-3 rounded-sm border border-n-1 bg-white p-3 no-underline"
                                >
                                    <span className="flex size-11 shrink-0 flex-col items-center justify-center rounded-sm border border-n-1 bg-primary-3 leading-none">
                                        <span className="text-h7">{entry.day}</span>
                                    </span>
                                    <span className="min-w-0 flex-1">
                                        <span className="block truncate text-h8">{entry.item.description}</span>
                                        <span className="block truncate text-xs text-grey-1">
                                            {entry.roomName} ·{' '}
                                            {entry.done
                                                ? t('fixedDone')
                                                : entry.today
                                                  ? t('fixedToday')
                                                  : t('fixedComing')}
                                        </span>
                                    </span>
                                    <Money
                                        minor={entry.item.amountMinor}
                                        currency={entry.item.currency}
                                        catalog={catalog}
                                        className="text-h8"
                                    />
                                </Link>
                            </li>
                        ))}
                    </ul>
                </>
            )}

            {pots.length > 0 && (
                <>
                    <SectionTitle title={t('potsTitle')} href="/vaquitas" more={t('seeAll')} />
                    <div className="grid gap-3" data-testid="home-pots">
                        {pots.slice(0, 3).map((pot) => (
                            <PotProgressCard key={`${pot.slug}-${pot.pot.id}`} pot={pot} catalog={catalog} />
                        ))}
                    </div>
                </>
            )}

            {tribus.length > 0 && (
                <>
                    <SectionTitle title={t('tribusTitle')} href="/tribus" more={t('seeAll')} />
                    <ul className="grid gap-2" data-testid="home-tribus">
                        {tribus.slice(0, 3).map((room) => (
                            <li key={room.slug}>
                                <Link
                                    href={roomHref(room.slug)}
                                    className="flex items-center gap-3 rounded-sm border border-n-1 bg-white p-3 no-underline"
                                >
                                    <span
                                        style={room.theme ? { backgroundColor: themeFor(room.theme).field } : undefined}
                                        className="flex size-10 shrink-0 items-center justify-center rounded-sm border border-n-1 bg-primary-3"
                                    >
                                        <RoomEmblem value={room.emoji} name={room.name} size={26} />
                                    </span>
                                    <span className="min-w-0 flex-1 truncate text-h7">{room.name}</span>
                                    <Icon name="chevron-right" size={18} className="shrink-0 text-grey-1" />
                                </Link>
                            </li>
                        ))}
                    </ul>
                </>
            )}
        </div>
    )
}

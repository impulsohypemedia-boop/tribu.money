'use client'

import { useMemo } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { tribuHola } from '@/assets/mascot'
import { Money } from '@/components/room/Money'
import { Doodle } from '@/components/ui/Doodle'
import { Icon } from '@/components/ui/Icon'
import { buttonClassName } from '@/components/ui/button-style'
import { decimalsOf } from '@/lib/money'
import { patrimony } from '@/lib/patrimony'
import { useMyRooms } from '@/lib/queries/my-rooms'
import { useCurrencies } from '@/lib/queries/reads'
import type { UsdRateTable } from '@/server/usd-rates'
import { PatrimonyChart } from './PatrimonyChart'
import { UsdMoney } from './UsdMoney'

const roomHref = (slug: string) => `/r/${encodeURIComponent(slug)}`

export function useUsdRates() {
    return useQuery({
        queryKey: ['usd-rates'],
        queryFn: async ({ signal }): Promise<UsdRateTable> => {
            const response = await fetch('/api/usd-rates', { signal })
            if (!response.ok) throw new Error(`usd-rates ${response.status}`)
            return response.json()
        },
        staleTime: 60 * 60 * 1000,
        retry: 1,
    })
}

/** Everything your tribus and vaquitas hold together, in dollars, and how it moved. */
export function usePatrimony() {
    const { rooms, recent, loading, ready } = useMyRooms()
    const { data: catalog } = useCurrencies()
    const rates = useUsdRates()
    const value = useMemo(
        () => patrimony(rooms, rates.data?.rates ?? {}, (code) => decimalsOf(code, catalog)),
        [rooms, rates.data, catalog]
    )
    return {
        value,
        rates: rates.data,
        catalog,
        loading: !ready || loading || rates.isPending,
        empty: ready && recent.length === 0,
    }
}

/** The tribus' money in dollars, one tap from the full patrimonio screen. */
export function PatrimonyCard() {
    const t = useTranslations('appShell.patrimony')
    const { value, loading } = usePatrimony()
    if (loading || value.byRoom.length === 0) return null
    return (
        <Link
            href="/patrimonio"
            data-testid="home-patrimony"
            className="mt-4 flex items-center gap-3 rounded-sm border border-n-1 bg-white p-3 no-underline"
        >
            <span className="flex size-10 shrink-0 items-center justify-center rounded-sm border border-n-1 bg-primary-3">
                <Doodle name="iconwallet" size={22} weight={1.8} />
            </span>
            <span className="min-w-0 flex-1">
                <span className="block truncate text-h8">{t('homeCard')}</span>
                <span className="block truncate text-xs text-grey-1">{t('homeCardHint')}</span>
            </span>
            <UsdMoney cents={value.totalUsdCents} className="text-h7" />
            <Icon name="chevron-right" size={16} className="shrink-0 text-grey-1" />
        </Link>
    )
}

export function PatrimonyScreen() {
    const t = useTranslations('appShell.patrimony')
    const { value, rates, catalog, loading, empty } = usePatrimony()

    if (empty || (!loading && value.byRoom.length === 0)) {
        return (
            <section data-testid="patrimony-empty" className="flex flex-col items-center px-5 pt-10 text-center">
                <Image src={tribuHola} alt="" unoptimized className="size-32 object-contain" />
                <h2 className="mt-4 text-h4">{t('emptyTitle')}</h2>
                <p className="mt-2 max-w-xs text-grey-1">{t('emptyBody')}</p>
                <Link
                    href="/new?tipo=vaquita"
                    className={buttonClassName({ shadowSize: '4', className: 'mt-6 justify-center no-underline' })}
                >
                    {t('startVaquita')}
                </Link>
            </section>
        )
    }

    const pricedByStatic = rates
        ? value.byCurrency.some((entry) => rates.sources[entry.currency] === 'static' && entry.currency !== 'USD')
        : false

    return (
        <div className="px-5 pb-8 pt-5" data-testid="patrimony">
            <section className="shadow-4 rounded-sm border border-n-1 bg-white p-4" aria-busy={loading}>
                <p className="text-sm text-grey-1">{t('totalLabel')}</p>
                {loading ? (
                    <p className="py-3 text-grey-1">{t('loading')}</p>
                ) : (
                    <>
                        <UsdMoney cents={value.totalUsdCents} className="block text-h2" />
                        <p className="mt-1 text-xs text-grey-1">{t('totalHint')}</p>
                        {value.history.length > 1 && (
                            <div className="mt-4 border-t border-dashed border-grey-2 pt-3">
                                <PatrimonyChart points={value.history} />
                                <p className="mt-2 text-xs text-grey-1">{t('chartHint')}</p>
                            </div>
                        )}
                    </>
                )}
            </section>

            {!loading && (
                <>
                    <h2 className="mb-3 mt-7 text-h6">{t('whereTitle')}</h2>
                    <ul className="grid gap-2" data-testid="patrimony-rooms">
                        {value.byRoom.map((room) => (
                            <li key={room.slug}>
                                <Link
                                    href={roomHref(room.slug)}
                                    className="flex items-center gap-3 rounded-sm border border-n-1 bg-white p-3 no-underline"
                                >
                                    <Doodle
                                        name={room.kind === 'vaquita' ? 'gift' : 'iconusers'}
                                        size={22}
                                        weight={1.8}
                                    />
                                    <span className="min-w-0 flex-1">
                                        <span className="block truncate text-h8">{room.name}</span>
                                        <span className="block truncate text-xs text-grey-1">
                                            {room.pots
                                                .map((pot) => pot.name)
                                                .filter((name) => name !== room.name)
                                                .join(' · ')}
                                        </span>
                                    </span>
                                    <span className="text-right">
                                        <Money
                                            minor={room.heldMinor}
                                            currency={room.currency}
                                            catalog={catalog}
                                            className="block text-h8"
                                        />
                                        {room.usdCents !== null && room.currency !== 'USD' && (
                                            <span className="block text-xs text-grey-1">
                                                ≈ <UsdMoney cents={room.usdCents} />
                                            </span>
                                        )}
                                    </span>
                                    <Icon name="chevron-right" size={16} className="shrink-0 text-grey-1" />
                                </Link>
                            </li>
                        ))}
                    </ul>

                    {value.byCurrency.length > 1 && (
                        <>
                            <h2 className="mb-3 mt-7 text-h6">{t('currenciesTitle')}</h2>
                            <ul
                                className="grid gap-1 rounded-sm border border-n-1 bg-white p-3"
                                data-testid="patrimony-currencies"
                            >
                                {value.byCurrency.map((entry) => (
                                    <li
                                        key={entry.currency}
                                        className="flex items-baseline justify-between gap-3 py-1 text-sm"
                                    >
                                        <span className="font-bold">{entry.currency}</span>
                                        <span className="text-right">
                                            <Money
                                                minor={entry.heldMinor}
                                                currency={entry.currency}
                                                catalog={catalog}
                                            />
                                            {entry.usdCents !== null && entry.currency !== 'USD' && (
                                                <span className="text-grey-1">
                                                    {' '}
                                                    · ≈ <UsdMoney cents={entry.usdCents} />
                                                </span>
                                            )}
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        </>
                    )}

                    <div className="mt-6 grid gap-1 text-xs text-grey-1" data-testid="patrimony-rates">
                        {rates?.arsPerUsd && <p>{t('pesoRate', { rate: Math.round(Number(rates.arsPerUsd)) })}</p>}
                        <p>{pricedByStatic ? t('ratesStatic') : t('ratesNote')}</p>
                        {value.unpriced.length > 0 && <p>{t('unpriced', { codes: value.unpriced.join(', ') })}</p>}
                    </div>
                </>
            )}
        </div>
    )
}

'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Doodle } from '@/components/ui/Doodle'
import type { DoodleName } from '@/components/ui/doodles'
import { cn } from '@/lib/cn'
import { AddAnythingSheet } from './AddAnythingSheet'

const TABS: { href: string; key: 'home' | 'tribus' | 'vaquitas' | 'me'; doodle: DoodleName }[] = [
    { href: '/app', key: 'home', doodle: 'house' },
    { href: '/tribus', key: 'tribus', doodle: 'iconusers' },
    { href: '/vaquitas', key: 'vaquitas', doodle: 'gift' },
    { href: '/yo', key: 'me', doodle: 'iconwallet' },
]

/**
 * The app's five-button menu: Inicio, Tribus, ＋, Vaquitas, Yo. It lives on the top-level
 * screens only; inside a tribu the room keeps its own bottom action.
 */
export function AppTabBar() {
    const t = useTranslations('appShell.nav')
    const pathname = usePathname()
    const [adding, setAdding] = useState(false)

    const tab = ({ href, key, doodle }: (typeof TABS)[number]) => {
        const active = pathname === href
        return (
            <Link
                key={href}
                href={href}
                aria-current={active ? 'page' : undefined}
                data-testid={`tab-${key}`}
                className={cn(
                    'flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-bold no-underline',
                    active ? 'text-n-1' : 'text-grey-1'
                )}
            >
                <span
                    className={cn(
                        'flex h-8 w-12 items-center justify-center rounded-xl transition-colors',
                        active && 'bg-n-1/[0.06]'
                    )}
                >
                    <Doodle name={doodle} size={22} weight={active ? 2.1 : 1.7} />
                </span>
                {t(key)}
                <span aria-hidden className={cn('size-1 rounded-full', active ? 'bg-primary-1' : 'bg-transparent')} />
            </Link>
        )
    }

    return (
        <>
            <nav
                aria-label={t('label')}
                data-testid="app-tab-bar"
                className="fixed inset-x-0 bottom-0 z-30 mx-auto flex w-full max-w-xl items-end border-t border-n-1 bg-background/90 px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-1 backdrop-blur"
            >
                {TABS.slice(0, 2).map(tab)}
                <div className="flex flex-1 justify-center">
                    <button
                        type="button"
                        onClick={() => setAdding(true)}
                        aria-label={t('add')}
                        data-testid="tab-add"
                        className="btn-shadow-primary-4 -mt-5 flex size-14 items-center justify-center rounded-2xl bg-primary-1 text-n-1 transition-transform active:translate-y-[2px]"
                    >
                        <Doodle name="iconplus" size={28} weight={2.4} />
                    </button>
                </div>
                {TABS.slice(2).map(tab)}
            </nav>
            <AddAnythingSheet open={adding} onClose={() => setAdding(false)} />
        </>
    )
}

/** Wraps a top-level screen so its content clears the menu. */
export function AppShellPage({ children }: { children: React.ReactNode }) {
    return (
        <>
            <div className="pb-28">{children}</div>
            <AppTabBar />
        </>
    )
}

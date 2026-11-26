import type { Metadata } from 'next'
import Link from 'next/link'
import { getTranslations } from 'next-intl/server'
import { AppScreen } from '@/components/app/AppScreen'
import { YourRooms } from '@/components/marketing/YourRooms'
import { Doodle } from '@/components/ui/Doodle'
import { buttonClassName } from '@/components/ui/button-style'

export const metadata: Metadata = {
    title: 'Tus tribus',
    alternates: { canonical: '/tribus' },
    robots: { index: false, follow: true },
}

/** Tribus: the groups saved on this device, a new one, an import, or a link to join. */
export default async function TribusPage({ searchParams }: { searchParams: Promise<{ add?: string | string[] }> }) {
    const { add } = await searchParams
    const [tShell, tCreate, tFooter, tHeader] = await Promise.all([
        getTranslations('appShell'),
        getTranslations('room.create'),
        getTranslations('marketing.footer'),
        getTranslations('room.header'),
    ])
    return (
        <AppScreen title={tShell('nav.tribus')} testId="app-tribus">
            <YourRooms
                surface="app"
                only="tribus"
                addExpense={add === '1'}
                entryActions={
                    <nav aria-label={tHeader('addOrJoinRoom')} className="mb-5 grid gap-3">
                        <Link
                            href="/new"
                            data-testid="app-new-split"
                            className={buttonClassName({
                                shadowSize: '4',
                                className: 'justify-center text-h6 no-underline',
                            })}
                        >
                            {tCreate('title')}
                            <Doodle name="iconarrowright" size={22} weight={2.2} />
                        </Link>
                        <Link
                            href="/import"
                            data-testid="app-import"
                            className={buttonClassName({
                                variant: 'stroke',
                                className: 'justify-center text-sm font-bold no-underline',
                            })}
                        >
                            {tFooter('importLink')}
                        </Link>
                    </nav>
                }
            />
        </AppScreen>
    )
}

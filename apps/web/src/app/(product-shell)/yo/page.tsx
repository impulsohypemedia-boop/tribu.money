import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { AppScreen } from '@/components/app/AppScreen'
import { MeScreen } from '@/components/app/MeScreen'

export const metadata: Metadata = {
    title: 'Yo',
    alternates: { canonical: '/yo' },
    robots: { index: false, follow: true },
}

export default async function MePage() {
    const t = await getTranslations('appShell')
    return (
        <AppScreen title={t('nav.me')} testId="app-me">
            <MeScreen />
        </AppScreen>
    )
}

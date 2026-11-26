import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { AppScreen } from '@/components/app/AppScreen'
import { VaquitasScreen } from '@/components/app/VaquitasScreen'

export const metadata: Metadata = {
    title: 'Tus vaquitas',
    alternates: { canonical: '/vaquitas' },
    robots: { index: false, follow: true },
}

export default async function VaquitasPage() {
    const t = await getTranslations('appShell')
    return (
        <AppScreen title={t('nav.vaquitas')} testId="app-vaquitas">
            <VaquitasScreen />
        </AppScreen>
    )
}

import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { AppScreen } from '@/components/app/AppScreen'
import { PatrimonyScreen } from '@/components/app/PatrimonyScreen'

export const metadata: Metadata = {
    title: 'Patrimonio',
    alternates: { canonical: '/patrimonio' },
    robots: { index: false, follow: true },
}

export default async function PatrimonyPage() {
    const t = await getTranslations('appShell.patrimony')
    return (
        <AppScreen title={t('title')} testId="app-patrimony">
            <PatrimonyScreen />
        </AppScreen>
    )
}

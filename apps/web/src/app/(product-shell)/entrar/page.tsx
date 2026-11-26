import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { AppScreen } from '@/components/app/AppScreen'
import { SignInScreen } from '@/components/account/SignInScreen'

export const metadata: Metadata = {
    title: 'Entrar',
    alternates: { canonical: '/entrar' },
    robots: { index: false, follow: false },
}

export default async function SignInPage() {
    const t = await getTranslations('account')
    return (
        <AppScreen title={t('pageTitle')} testId="app-sign-in">
            <SignInScreen />
        </AppScreen>
    )
}

'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/Button'
import { useInLemon } from '@/components/lemon/LemonProvider'
import { googleSignInUrl } from '@/lib/account'
import { api } from '@/lib/api'
import { ACCOUNT_QUERY_KEY, useAccount } from './useAccount'

/** Where Google sends people back to. The page there finishes the sign-in. */
export const SIGN_IN_PATH = '/entrar'

export function startGoogleSignIn(): boolean {
    const url = googleSignInUrl(`${window.location.origin}${SIGN_IN_PATH}`)
    if (!url) return false
    window.location.assign(url)
    return true
}

/** "Tu cuenta" in Yo: sign in with Google so your tribus follow you to any phone. */
export function AccountSection() {
    const t = useTranslations('account')
    const queryClient = useQueryClient()
    const inLemon = useInLemon()
    const { data, isLoading } = useAccount()
    const [leaving, setLeaving] = useState(false)
    const [going, setGoing] = useState(false)

    if (isLoading || !data?.enabled) return null

    const signOut = async () => {
        setLeaving(true)
        try {
            await api.signOut()
            await queryClient.invalidateQueries({ queryKey: ACCOUNT_QUERY_KEY })
        } finally {
            setLeaving(false)
        }
    }

    return (
        <section className="shadow-4 grid gap-3 rounded-sm border border-n-1 bg-white p-4" data-testid="me-account">
            <h2 className="text-h6">{t('title')}</h2>
            {data.account ? (
                <>
                    <p className="text-sm">
                        {data.account.email ? t('signedInAs', { email: data.account.email }) : t('signedIn')}
                    </p>
                    <p className="text-xs text-grey-1">{t('signedInHint')}</p>
                    <Button
                        variant="stroke"
                        className="justify-center"
                        onClick={() => void signOut()}
                        loading={leaving}
                        data-testid="account-sign-out"
                    >
                        {t('signOut')}
                    </Button>
                </>
            ) : inLemon ? (
                <p className="text-sm text-grey-1">{t('inLemon')}</p>
            ) : (
                <>
                    <p className="text-sm text-grey-1">{t('pitch')}</p>
                    <Button
                        variant="primary"
                        className="justify-center"
                        loading={going}
                        onClick={() => setGoing(startGoogleSignIn())}
                        data-testid="account-google"
                    >
                        {t('google')}
                    </Button>
                </>
            )}
        </section>
    )
}

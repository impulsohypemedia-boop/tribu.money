'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useQueryClient } from '@tanstack/react-query'
import { readAuthFragment } from '@/lib/account'
import { api } from '@/lib/api'
import { AccountSection } from './AccountSection'
import { ACCOUNT_QUERY_KEY } from './useAccount'

/**
 * Google sends people back here with the Supabase access token in the URL fragment. The fragment
 * never reaches a server log; it is read here, swapped for Tribu's cookie and wiped from the URL.
 */
export function SignInScreen() {
    const t = useTranslations('account')
    const router = useRouter()
    const queryClient = useQueryClient()
    const [status, setStatus] = useState<'idle' | 'working' | 'failed'>('idle')
    const started = useRef(false)

    useEffect(() => {
        if (started.current) return
        started.current = true
        const result = readAuthFragment(window.location.hash)
        if (!result) return
        window.history.replaceState(null, '', window.location.pathname)
        if ('error' in result) {
            setStatus('failed')
            return
        }
        setStatus('working')
        api.signInWithAccessToken(result.accessToken)
            .then(async () => {
                await queryClient.invalidateQueries({ queryKey: ACCOUNT_QUERY_KEY })
                router.replace('/yo')
            })
            .catch(() => setStatus('failed'))
    }, [queryClient, router])

    return (
        <div className="grid gap-4 px-5 pt-5" data-testid="sign-in">
            {status === 'working' && <p className="text-sm">{t('finishing')}</p>}
            {status === 'failed' && (
                <p className="text-sm text-[#B42318]" role="alert">
                    {t('failed')}
                </p>
            )}
            {status !== 'working' && <AccountSection />}
        </div>
    )
}

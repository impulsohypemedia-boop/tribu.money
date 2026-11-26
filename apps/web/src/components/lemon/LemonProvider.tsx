'use client'

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { detectLemon, lemonSignIn, type LemonSession } from '@/lib/lemon/client'

export type LemonStatus = 'checking' | 'outside' | 'signing-in' | 'signed-in' | 'declined' | 'error'

interface LemonContextValue {
    status: LemonStatus
    session: LemonSession | null
    /** Ask Lemon again, after the user declined or the sign-in failed. */
    retry: () => void
}

const LemonContext = createContext<LemonContextValue>({ status: 'outside', session: null, retry: () => {} })

export const useLemon = () => useContext(LemonContext)
export const useInLemon = () => {
    const { status } = useLemon()
    return status !== 'outside' && status !== 'checking'
}

/**
 * Detects Lemon's app once per page load and, inside it, signs in straight away: Lemon's rules
 * require `authenticate` first, on every entry. Outside Lemon the status settles on `outside` and
 * Tribu behaves exactly like the plain PWA.
 */
export function LemonProvider({ children }: { children: React.ReactNode }) {
    const [status, setStatus] = useState<LemonStatus>('checking')
    const [session, setSession] = useState<LemonSession | null>(null)
    const running = useRef(false)

    const signIn = useCallback(async () => {
        if (running.current) return
        running.current = true
        setStatus('signing-in')
        try {
            const result = await lemonSignIn()
            if (result.ok) {
                setSession(result.session)
                setStatus('signed-in')
            } else {
                setStatus(result.cancelled ? 'declined' : 'error')
            }
        } catch {
            setStatus('error')
        } finally {
            running.current = false
        }
    }, [])

    useEffect(() => {
        let alive = true
        void detectLemon().then((inLemon) => {
            if (!alive) return
            if (!inLemon) {
                setStatus('outside')
                return
            }
            void signIn()
        })
        return () => {
            alive = false
        }
    }, [signIn])

    return (
        <LemonContext.Provider value={{ status, session, retry: () => void signIn() }}>
            {children}
        </LemonContext.Provider>
    )
}

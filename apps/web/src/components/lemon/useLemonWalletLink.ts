'use client'

import { useEffect, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import type { ApiMember } from '@/lib/api-types'
import { api } from '@/lib/api'
import { sameAddress } from '@/lib/lemon/chain'
import { seedRoomState } from '@/lib/queries/core'
import { useLemon } from './LemonProvider'

/**
 * Inside Lemon, the member holding the phone is paid at the wallet Lemon just signed in. Linked once
 * per room per wallet; a failure is silent here and only means "Pagar con Lemon" is not offered to
 * whoever owes this member, which the settle sheet explains.
 */
export function useLemonWalletLink(slug: string, me: ApiMember | null, token: string | null | undefined) {
    const { session } = useLemon()
    const queryClient = useQueryClient()
    const attempted = useRef<string | null>(null)

    useEffect(() => {
        if (!session || !me || !token) return
        if (sameAddress(me.walletAddress, session.wallet) && (me.lemonTag ?? null) === session.lemonTag) return
        const attempt = `${slug}|${me.id}|${session.wallet}`
        if (attempted.current === attempt) return
        attempted.current = attempt
        api.linkWallet(
            slug,
            me.id,
            {
                wallet: session.wallet,
                message: session.message,
                signature: session.signature,
                lemonTag: session.lemonTag,
            },
            token
        )
            .then((state) => seedRoomState(queryClient, slug, state))
            .catch(() => {})
    }, [session, me, token, slug, queryClient])
}

'use client'

import { useEffect, useRef } from 'react'
import { ACCOUNT_ROOMS_EVENT, adoptMemberships, heldMemberships } from '@/lib/account'
import { api } from '@/lib/api'
import { useAccount } from './useAccount'

/**
 * Runs once per page load and renders nothing. When someone is signed in, this device's tribus go
 * up to their account and the account's other tribus come down here.
 */
export function AccountSync() {
    const { data } = useAccount()
    const synced = useRef<string | null>(null)
    const email = data?.account ? (data.account.email ?? '') : null

    useEffect(() => {
        if (email === null || synced.current === email) return
        synced.current = email
        api.syncAccountRooms(heldMemberships())
            .then(({ memberships }) => {
                if (adoptMemberships(memberships) > 0) window.dispatchEvent(new Event(ACCOUNT_ROOMS_EVENT))
            })
            .catch(() => {
                synced.current = null
            })
    }, [email])

    return null
}

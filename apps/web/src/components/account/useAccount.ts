'use client'

import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'

export const ACCOUNT_QUERY_KEY = ['account'] as const

/** Who is signed in on this device. `enabled` is false where sign-in is not configured. */
export function useAccount() {
    return useQuery({
        queryKey: ACCOUNT_QUERY_KEY,
        queryFn: () => api.account(),
        staleTime: 5 * 60_000,
        retry: 1,
    })
}

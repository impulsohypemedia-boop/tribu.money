'use client'

import { useEffect, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { api } from './api'
import type { ApiMember } from './api-types'
import { profileInput, readMyPaymentProfile } from './my-payment-profile'
import { hasPaymentMethod, paymentMethodsOf } from './payout'
import { roomKey } from './queries/core'

/**
 * A tribu joined after the person filled in "Cómo te pagan" picks the profile up on its own, so
 * the people who owe them see where to pay without a trip to "Yo". Only a member with nothing
 * saved is filled in; one who already set something in this tribu keeps it.
 */
export function usePaymentProfileSync(slug: string, me: ApiMember | null, token?: string | null) {
    const queryClient = useQueryClient()
    const tried = useRef<string | null>(null)

    useEffect(() => {
        if (!me || !token || tried.current === me.id) return
        tried.current = me.id
        if (hasPaymentMethod(paymentMethodsOf({ ...me, lemonTag: null }))) return
        const profile = readMyPaymentProfile()
        if (!profile || !hasPaymentMethod(profile)) return
        api.setMemberProfile(slug, me.id, profileInput(profile), token)
            .then((next) => queryClient.setQueryData(roomKey(slug), next))
            .catch(() => {
                // Best effort: "Yo" can still write it to every tribu by hand.
            })
    }, [me, queryClient, slug, token])
}

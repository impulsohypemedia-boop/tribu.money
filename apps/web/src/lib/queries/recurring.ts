import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../api'
import { seedRoomState } from './core'

/** Start or stop repeating an expense every month. Not optimistic: the server decides which
 * months exist, and a template that failed to start must not look started. */
export function useStartRecurring(slug: string) {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: (expenseId: string) => api.startRecurring(slug, expenseId),
        onSuccess: (state) => seedRoomState(queryClient, slug, state),
    })
}

export function useStopRecurring(slug: string) {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: (recurringId: string) => api.stopRecurring(slug, recurringId),
        onSuccess: (state) => seedRoomState(queryClient, slug, state),
    })
}

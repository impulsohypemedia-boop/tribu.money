import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../api'
import { seedRoomState } from './core'

export function useSendReminder(slug: string, token?: string | null) {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: (toId: string) => api.sendReminder(slug, toId, token),
        onSuccess: (state) => seedRoomState(queryClient, slug, state),
    })
}

export function useDismissReminder(slug: string, token?: string | null) {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: (reminderId: string) => api.dismissReminder(slug, reminderId, token),
        onSuccess: (state) => seedRoomState(queryClient, slug, state),
    })
}

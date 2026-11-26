import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../api'
import { seedRoomState } from './core'

export function useSaveCoupleSplit(slug: string, token?: string | null) {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: (split: Record<string, number> | null) => api.saveCoupleSplit(slug, split, token),
        onSuccess: (state) => seedRoomState(queryClient, slug, state),
    })
}

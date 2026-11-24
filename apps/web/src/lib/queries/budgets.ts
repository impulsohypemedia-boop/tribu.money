import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../api'
import type { ApiBudget } from '../api-types'
import { seedRoomState } from './core'

export function useSaveBudgets(slug: string) {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: (budgets: ApiBudget[]) => api.saveBudgets(slug, budgets),
        onSuccess: (state) => seedRoomState(queryClient, slug, state),
    })
}

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../api'
import type { PotInput, RoomState } from '../api-types'
import { seedRoomState } from './core'

/**
 * La vaquita's writes. Not optimistic: a contribution is a payment to the keeper, and a payment
 * that only looks recorded is the worst state a split app can show.
 */
function usePotMutation<T>(slug: string, write: (input: T) => Promise<RoomState>) {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: write,
        onSuccess: (state) => seedRoomState(queryClient, slug, state),
    })
}

export const useCreatePot = (slug: string, token?: string | null) =>
    usePotMutation(slug, (input: PotInput) => api.createPot(slug, input, token))

export const useUpdatePot = (slug: string, token?: string | null) =>
    usePotMutation(slug, ({ potId, ...input }: Partial<PotInput> & { potId: string; closed?: boolean }) =>
        api.updatePot(slug, potId, input, token)
    )

export const useAddPotContribution = (slug: string, token?: string | null) =>
    usePotMutation(
        slug,
        ({ potId, ...input }: { potId: string; memberId: string; amountMinor: string; reason?: 'roundup' | null }) =>
            api.addPotContribution(slug, potId, input, token)
    )

export const useRemovePotContribution = (slug: string, token?: string | null) =>
    usePotMutation(slug, ({ potId, contributionId }: { potId: string; contributionId: string }) =>
        api.removePotContribution(slug, potId, contributionId, token)
    )

export const useLinkPotExpense = (slug: string, token?: string | null) =>
    usePotMutation(slug, ({ potId, expenseId, linked }: { potId: string; expenseId: string; linked: boolean }) =>
        linked ? api.linkPotExpense(slug, potId, expenseId, token) : api.unlinkPotExpense(slug, potId, expenseId, token)
    )

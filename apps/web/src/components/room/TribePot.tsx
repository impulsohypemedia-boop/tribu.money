'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { Button } from '@/components/ui/Button'
import { Doodle } from '@/components/ui/Doodle'
import type { RoomState } from '@/lib/api-types'
import { useErrorMessage } from '@/lib/error-messages'
import { activeMembers } from '@/lib/members'
import { openPots } from '@/lib/pots'
import { useCreatePot } from '@/lib/queries/pots'
import { TOAST_MS } from '@/lib/toasts'
import { MemberChips } from './Vaquita'

/**
 * El pozo de la tribu: one pot inside a tribu, kept in one member's account like a vaquita, where
 * the round-ups from Quedar a mano go. Offered only while the tribu has no open pot; once it has
 * one, the pot shows as a card like any other.
 */
export function TribePotSetup({
    slug,
    state,
    meId,
    token,
}: {
    slug: string
    state: RoomState
    meId?: string | null
    token?: string | null
}) {
    const t = useTranslations('room.tribePot')
    const errorMessage = useErrorMessage()
    const createPot = useCreatePot(slug, token)
    const [open, setOpen] = useState(false)
    const [keeperId, setKeeperId] = useState(meId ?? '')
    const roster = activeMembers(state.members)

    if (openPots(state).length > 0 || roster.length < 2) return null

    const create = async () => {
        if (!keeperId) return
        try {
            await createPot.mutateAsync({ name: t('defaultName'), keeperId })
            setOpen(false)
            toast(t('created'), { duration: TOAST_MS.actionable })
        } catch (error) {
            toast.error(errorMessage(error), { duration: TOAST_MS.actionable })
        }
    }

    if (!open)
        return (
            <button
                type="button"
                onClick={() => setOpen(true)}
                className="mb-4 flex w-full items-center gap-3 rounded-sm border border-dashed border-n-1 bg-white/60 p-3 text-left"
                data-testid="tribe-pot-start"
            >
                <Doodle name="expense_coins" size={26} weight={1.8} className="shrink-0" />
                <span className="grid gap-0.5">
                    <span className="text-h8">{t('start')}</span>
                    <span className="text-sm text-grey-1">{t('startHint')}</span>
                </span>
            </button>
        )

    return (
        <div className="mb-4 grid gap-3 rounded-sm border border-n-1 bg-white p-3" data-testid="tribe-pot-form">
            <p className="text-h8">{t('formTitle')}</p>
            <p className="text-sm text-grey-1">{t('formHint')}</p>
            <span className="text-sm font-bold">{t('keeper')}</span>
            <MemberChips members={roster} value={keeperId} onChange={setKeeperId} testId="tribe-pot-keeper" />
            <div className="flex gap-2">
                <Button variant="stroke" width="auto" className="flex-1 justify-center" onClick={() => setOpen(false)}>
                    {t('cancel')}
                </Button>
                <Button
                    width="auto"
                    shadowSize="4"
                    className="flex-1 justify-center"
                    loading={createPot.isPending}
                    disabled={!keeperId}
                    onClick={() => void create()}
                    data-testid="tribe-pot-create"
                >
                    {t('create')}
                </Button>
            </div>
        </div>
    )
}

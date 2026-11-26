'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { Button } from '@/components/ui/Button'
import { shareImageFile, useSharePng } from '@/lib/share-card'
import { TOAST_MS } from '@/lib/toasts'
import { useFeedback } from '@/lib/use-settings'

/**
 * Shares the tall stories image of a trip or a vaquita. Like every card, it leaves as a file:
 * the image is fetched ahead so the tap can open the native share sheet straight away.
 */
export function StoryShareButton({ slug, variant = 'primary' }: { slug: string; variant?: 'primary' | 'stroke' }) {
    const t = useTranslations('room.storyCard')
    const tCards = useTranslations('room.achievements')
    const feedback = useFeedback()
    const [busy, setBusy] = useState(false)
    const { file } = useSharePng(`/r/${encodeURIComponent(slug)}/recap/story`, 'tribu-stories.png')

    const share = async () => {
        if (busy) return
        setBusy(true)
        try {
            feedback('whoosh')
            if (!file) throw new Error('story image is not ready')
            const tier = await shareImageFile(file)
            if (tier === 'clipboard') toast(tCards('copied'), { duration: TOAST_MS.default })
            if (tier === 'download') toast(tCards('downloaded'), { duration: TOAST_MS.state })
        } catch (error) {
            if (error instanceof DOMException && error.name === 'AbortError') return
            feedback('error', { haptic: 'error' })
            toast(tCards('shareFailed'), { duration: TOAST_MS.actionable })
        } finally {
            setBusy(false)
        }
    }

    return (
        <Button
            variant={variant}
            shadowSize={variant === 'primary' ? '4' : undefined}
            icon="share"
            loading={busy}
            onClick={() => void share()}
            className="justify-center"
            aria-label={t('shareLabel')}
            data-testid="share-story"
        >
            {busy ? t('sharing') : t('share')}
        </Button>
    )
}

'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { TribuSymbol } from '@/components/ui/TribuLogo'
import { landingLinkTarget } from '@/lib/app-entry'

/**
 * The way back from the accountless home to the landing, for someone who is only browsing. It is
 * the ronda in the header, with no visible text: the logo is where people expect to tap to go home.
 *
 * Renders as an ordinary in-tab link first — the server cannot see the display mode — and
 * switches to a new-tab link once the client knows it is running installed. A tap before
 * hydration in the app is not lost: it lands on `/`, which redirects back here.
 */
export function LandingLink() {
    const t = useTranslations('marketing.appHome')
    const [target, setTarget] = useState<'_blank' | undefined>(undefined)

    useEffect(() => {
        const navigatorStandalone = (navigator as Navigator & { standalone?: boolean }).standalone
        const displayModeStandalone = window.matchMedia?.('(display-mode: standalone)').matches ?? false
        setTarget(landingLinkTarget(displayModeStandalone, navigatorStandalone))
    }, [])

    return (
        <Link
            href="/"
            target={target}
            rel={target ? 'noopener noreferrer' : undefined}
            data-testid="app-landing-link"
            aria-label={t('landingLink')}
            className="inline-flex size-11 shrink-0 items-center justify-center rounded-full"
        >
            <TribuSymbol size={36} />
        </Link>
    )
}

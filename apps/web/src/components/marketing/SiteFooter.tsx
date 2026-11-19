import Link from 'next/link'
import { useTranslations } from 'next-intl'

/**
 * Tribu builds on AGPL-3.0 code, so anyone using the hosted app must be able to get its source.
 * The footer stays minimal, but that one link is a license obligation and must not be removed.
 */
export const SOURCE_URL = 'https://github.com/impulsohypemedia-boop/tribu.money'

export function SiteFooter() {
    const t = useTranslations('marketing.footer')
    const linkClass = 'text-xs text-n-1/50 transition-colors hover:text-n-1'

    return (
        <footer className="mt-auto pb-[env(safe-area-inset-bottom)]">
            <ul className="mx-auto flex w-full max-w-xl items-center justify-center gap-4 px-5 py-6">
                <li>
                    <Link href="/privacy" className={linkClass}>
                        {t('privacyLink')}
                    </Link>
                </li>
                <li>
                    <a href={SOURCE_URL} target="_blank" rel="noopener noreferrer" className={linkClass}>
                        {t('sourceStewardship')}
                    </a>
                </li>
            </ul>
        </footer>
    )
}

export default SiteFooter

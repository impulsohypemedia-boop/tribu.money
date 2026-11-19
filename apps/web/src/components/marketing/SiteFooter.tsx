import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { LocaleSwitcher } from '@/components/ui/LocaleSwitcher'

/** Tribu is a fork of Peanut Split, AGPL-3.0: the source link is a license obligation, not decoration. */
export const SOURCE_URL = 'https://github.com/impulsohypemedia-boop/tribu.money'

export function SiteFooter({ showLocaleSwitcher = true }: { showLocaleSwitcher?: boolean }) {
    const t = useTranslations('marketing.footer')
    const tLocale = useTranslations('locale')
    const linkClass = 'text-sm text-white/70 transition-colors hover:text-white'

    return (
        <footer data-focus-surface="dark" className="mt-auto bg-n-1 pb-[env(safe-area-inset-bottom)] text-white">
            <div className="mx-auto flex w-full max-w-xl flex-wrap items-center justify-between gap-4 px-5 py-6">
                <ul className="flex flex-wrap items-center gap-4">
                    <li>
                        <Link href="/new" className={linkClass}>
                            {t('createSplit')}
                        </Link>
                    </li>
                    <li>
                        <Link href="/import" className={linkClass}>
                            {t('importLink')}
                        </Link>
                    </li>
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
                {showLocaleSwitcher && <LocaleSwitcher label={tLocale('label')} compact />}
            </div>
            <p className="mx-auto w-full max-w-xl px-5 pb-4 text-xs leading-5 text-white/70">{t('operatedBy')}</p>
        </footer>
    )
}

export default SiteFooter

import Link from 'next/link'
import { useTranslations } from 'next-intl'

export function SiteFooter() {
    const t = useTranslations('marketing.footer')

    return (
        <footer className="mt-auto pb-[env(safe-area-inset-bottom)]">
            <div className="mx-auto flex w-full max-w-xl justify-center px-5 py-6">
                <Link href="/privacy" className="text-xs text-n-1/50 transition-colors hover:text-n-1">
                    {t('privacyLink')}
                </Link>
            </div>
        </footer>
    )
}

export default SiteFooter

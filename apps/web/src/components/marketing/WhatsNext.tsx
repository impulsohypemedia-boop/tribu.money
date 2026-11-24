import { useTranslations } from 'next-intl'

/** Where Tribu is heading, labelled as not built yet so it reads as a direction, not a feature. */
export function WhatsNext() {
    const t = useTranslations('marketing.landingNext')

    return (
        <section className="mx-auto w-full max-w-2xl px-5 pb-10">
            <div className="rounded-2xl border border-dashed border-n-1/30 bg-secondary-1/15 p-5">
                <span className="rounded-full bg-secondary-1 px-2.5 py-1 text-xs font-bold uppercase tracking-wide text-n-1">
                    {t('badge')}
                </span>
                <h2 className="mt-3 font-display text-xl font-extrabold text-n-1">{t('title')}</h2>
                <p className="mt-1 text-sm leading-5 text-n-1/70">{t('body')}</p>
            </div>
        </section>
    )
}

export default WhatsNext

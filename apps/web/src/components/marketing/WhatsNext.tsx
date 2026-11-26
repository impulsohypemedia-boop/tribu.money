import { useTranslations } from 'next-intl'
import { RONDA_COLORS } from '@/components/ui/TribuLogo'

const ITEMS = [1, 2, 3] as const

/** Where Tribu is heading, labelled as not built yet so it reads as a direction, not a feature. */
export function WhatsNext() {
    const t = useTranslations('marketing.landingNext')

    return (
        <section className="mx-auto w-full max-w-2xl px-5 pb-10">
            <div className="card-ronda p-5">
                <span className="rounded-full border-2 border-n-1 bg-secondary-1 px-2.5 py-0.5 text-xs font-bold uppercase tracking-wide text-n-1">
                    {t('badge')}
                </span>
                <h2 className="mt-3 font-display text-xl text-n-1">{t('title')}</h2>
                <p className="mt-1 text-sm leading-5 text-n-1/70">{t('body')}</p>
                <ul className="mt-4 grid gap-3" data-testid="whats-next-items">
                    {ITEMS.map((i) => (
                        <li key={i} className="flex gap-3">
                            <span
                                aria-hidden
                                className="mt-1 size-3 shrink-0 rounded-full border-2 border-n-1"
                                style={{ backgroundColor: RONDA_COLORS[i] }}
                            />
                            <span className="min-w-0">
                                <span className="block text-sm font-bold text-n-1">{t(`item${i}Title`)}</span>
                                <span className="block text-sm leading-5 text-n-1/70">{t(`item${i}Body`)}</span>
                            </span>
                        </li>
                    ))}
                </ul>
            </div>
        </section>
    )
}

export default WhatsNext

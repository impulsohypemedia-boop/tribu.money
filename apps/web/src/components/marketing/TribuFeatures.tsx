import { useTranslations } from 'next-intl'
import { Doodle } from '@/components/ui/Doodle'
import type { DoodleName } from '@/components/ui/doodles'

const FEATURES: { key: 'record' | 'settle' | 'pool' | 'remind'; doodle: DoodleName }[] = [
    { key: 'record', doodle: 'tally' },
    { key: 'settle', doodle: 'swap' },
    { key: 'pool', doodle: 'gift' },
    { key: 'remind', doodle: 'phone' },
]

/** The parts of a tribu's account, each one a feature that exists today. */
export function TribuFeatures() {
    const t = useTranslations('marketing.landingFeatures')

    return (
        <section className="mx-auto w-full max-w-2xl px-5 py-10">
            <h2 className="font-display text-2xl font-extrabold text-n-1">{t('title')}</h2>
            <ul className="mt-5 grid gap-3 sm:grid-cols-2">
                {FEATURES.map(({ key, doodle }) => (
                    <li key={key} className="shadow-4 flex items-start gap-4 rounded-2xl bg-white p-4">
                        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary-3 text-n-1">
                            <Doodle name={doodle} size={22} weight={2} />
                        </span>
                        <span>
                            <span className="block font-bold text-n-1">{t(`${key}.title`)}</span>
                            <span className="mt-1 block text-sm leading-5 text-n-1/70">{t(`${key}.body`)}</span>
                        </span>
                    </li>
                ))}
            </ul>
        </section>
    )
}

export default TribuFeatures

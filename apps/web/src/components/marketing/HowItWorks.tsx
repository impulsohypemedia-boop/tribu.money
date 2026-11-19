import { useTranslations } from 'next-intl'

const STEPS = ['create', 'share', 'settle'] as const

/** Three steps, in Tribu's words, below the hero. */
export function HowItWorks() {
    const t = useTranslations('marketing.howItWorks')

    return (
        <section className="mx-auto w-full max-w-2xl px-5 py-10">
            <h2 className="font-display text-2xl font-extrabold text-n-1">{t('title')}</h2>
            <ol className="mt-5 flex flex-col gap-3">
                {STEPS.map((step, index) => (
                    <li key={step} className="shadow-4 flex items-start gap-4 rounded-2xl bg-white p-4">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-1 font-display text-lg font-extrabold text-white">
                            {index + 1}
                        </span>
                        <span>
                            <span className="block font-bold text-n-1">{t(`${step}.title`)}</span>
                            <span className="mt-1 block text-sm leading-5 text-n-1/70">{t(`${step}.body`)}</span>
                        </span>
                    </li>
                ))}
            </ol>
        </section>
    )
}

export default HowItWorks

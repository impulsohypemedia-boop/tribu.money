import Image from 'next/image'
import { useTranslations } from 'next-intl'
import { tribuHola } from '@/assets/mascot'
import { HeroCreateForm } from './HeroCreateForm'

/** Tribu's landing hero: the mascot, one promise, and the real create form. */
export function TribuHero() {
    const t = useTranslations('marketing.hero')

    return (
        <section className="relative overflow-hidden bg-gradient-to-b from-primary-3 to-background">
            <div className="mx-auto flex w-full max-w-2xl flex-col items-center px-5 pb-10 pt-8 text-center lg:py-14">
                <Image
                    src={tribuHola}
                    alt=""
                    priority
                    unoptimized
                    className="h-36 w-36 object-contain lg:h-44 lg:w-44"
                />
                <h1 className="mt-3 font-display text-[2.4rem] font-extrabold leading-[1.05] text-n-1 lg:text-[3.25rem]">
                    {t('title')}
                </h1>
                <p className="mt-3 max-w-md text-base leading-6 text-n-1/75">{t('subtitle')}</p>
                <div className="mt-6 w-full text-left">
                    <HeroCreateForm analyticsVariant="control" />
                </div>
            </div>
        </section>
    )
}

export default TribuHero

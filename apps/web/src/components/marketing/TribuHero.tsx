import Image from 'next/image'
import { useTranslations } from 'next-intl'
import { tribuFestejo, tribuHola, tribuPensando, tribuSenalando, tribuTriste } from '@/assets/mascot'
import { buttonClassName } from '@/components/ui/button-style'
import { TribuLogo } from '@/components/ui/TribuLogo'
import { AccountPreview } from './AccountPreview'

/** The cast, left to right: Olvi, Paco, Tita, Ruli, Fede. */
const BANDA = [tribuPensando, tribuFestejo, tribuHola, tribuSenalando, tribuTriste]

/** Tribu's landing hero: what Tribu is, one action, and a picture of a tribu's account. */
export function TribuHero() {
    const t = useTranslations('marketing.hero')

    return (
        <section className="relative overflow-hidden bg-background">
            <div className="mx-auto flex w-full max-w-2xl flex-col items-center px-5 pb-10 pt-6 text-center lg:py-12">
                <TribuLogo size={40} className="mb-8" />
                <span className="rounded-full bg-n-1 px-3 py-1 text-xs font-bold uppercase tracking-wide text-white">
                    {t('eyebrow')}
                </span>
                <h1 className="mt-4 font-display text-[2.6rem] leading-[1] text-n-1 lg:text-[3.4rem]">{t('title')}</h1>
                <p className="mt-3 max-w-md text-base leading-6 text-n-1/75">{t('subtitle')}</p>
                <a
                    href="#armar"
                    data-testid="hero-cta"
                    className={buttonClassName({
                        shadowSize: '4',
                        className: 'mt-6 w-full max-w-xs justify-center no-underline',
                    })}
                >
                    {t('cta')}
                </a>
                <p className="mt-2 text-xs text-n-1/60">{t('ctaNote')}</p>
                <div className="relative mt-24 w-full max-w-sm">
                    <div aria-hidden className="absolute inset-x-0 -top-[5.2rem] z-10 flex justify-center gap-0.5">
                        {BANDA.map((src, i) => (
                            <Image
                                key={i}
                                src={src}
                                alt=""
                                priority={i === 2}
                                unoptimized
                                className="h-[5.6rem] w-[4.6rem] object-contain"
                            />
                        ))}
                    </div>
                    <AccountPreview />
                </div>
            </div>
        </section>
    )
}

export default TribuHero

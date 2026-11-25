import Image from 'next/image'
import { useTranslations } from 'next-intl'
import { tribuHola } from '@/assets/mascot'
import { buttonClassName } from '@/components/ui/button-style'
import { TribuLogo } from '@/components/ui/TribuLogo'
import { AccountPreview } from './AccountPreview'

/** Tribu's landing hero: what Tribu is, one action, and a picture of a tribu's account. */
export function TribuHero() {
    const t = useTranslations('marketing.hero')

    return (
        <section className="relative overflow-hidden bg-background bg-[radial-gradient(rgb(13_27_42/0.07)_1px,transparent_1px)] [background-size:18px_18px]">
            <div className="mx-auto flex w-full max-w-2xl flex-col items-center px-5 pb-10 pt-6 text-center lg:py-12">
                <TribuLogo size={30} className="mb-8" />
                <span className="rounded-full bg-n-1 px-3 py-1 text-xs font-bold uppercase tracking-wide text-white">
                    {t('eyebrow')}
                </span>
                <h1 className="mt-4 font-display text-[2.5rem] font-extrabold leading-[1] tracking-[-0.045em] text-n-1 lg:text-[3.4rem]">
                    {t('title')}
                </h1>
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
                <div className="relative mt-8 w-full max-w-sm">
                    <Image
                        src={tribuHola}
                        alt=""
                        priority
                        unoptimized
                        className="absolute -top-[5.4rem] right-4 z-10 h-24 w-24 object-contain"
                    />
                    <AccountPreview />
                </div>
            </div>
        </section>
    )
}

export default TribuHero

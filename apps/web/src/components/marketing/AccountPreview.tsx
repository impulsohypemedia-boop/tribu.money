import { useTranslations } from 'next-intl'
import { Doodle } from '@/components/ui/Doodle'
import type { DoodleName } from '@/components/ui/doodles'

const ROWS: { key: 'month' | 'owed' | 'pot' | 'fixed'; doodle: DoodleName }[] = [
    { key: 'month', doodle: 'tally' },
    { key: 'owed', doodle: 'swap' },
    { key: 'pot', doodle: 'gift' },
    { key: 'fixed', doodle: 'house' },
]

/**
 * An example tribu drawn as an account card. Every row is something the app already shows
 * (monthly total, who pays whom, a vaquita's progress, a fixed expense), so the picture does not
 * promise a feature that is not there. Decorative: screen readers get the caption only.
 */
export function AccountPreview() {
    const t = useTranslations('marketing.landingPreview')

    return (
        <figure className="text-left">
            <div
                aria-hidden
                className="shadow-primary-6 rounded-2xl border border-n-1 bg-n-1 p-5 text-white"
                data-testid="landing-account-preview"
            >
                <div className="flex items-center justify-between gap-3">
                    <div>
                        <p className="font-display text-xl font-extrabold">{t('name')}</p>
                        <p className="text-sm text-white/60">{t('people')}</p>
                    </div>
                    <span className="flex size-11 items-center justify-center rounded-full bg-secondary-1 text-n-1">
                        <Doodle name="tribu" size={24} weight={2} />
                    </span>
                </div>
                <ul className="mt-5 grid gap-2">
                    {ROWS.map(({ key, doodle }) => (
                        <li key={key} className="flex items-center gap-3 rounded-xl bg-white/[0.07] px-3 py-2.5">
                            <Doodle name={doodle} size={20} weight={1.8} className="shrink-0 text-secondary-1" />
                            <span className="flex-1 text-sm text-white/80">{t(`${key}Label`)}</span>
                            <span className="text-sm font-bold">{t(`${key}Value`)}</span>
                        </li>
                    ))}
                </ul>
                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10">
                    <div className="h-full w-[62%] rounded-full bg-secondary-1" />
                </div>
            </div>
            <figcaption className="mt-2 text-center text-xs text-n-1/60">{t('label')}</figcaption>
        </figure>
    )
}

export default AccountPreview

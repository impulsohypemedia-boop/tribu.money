import { useTranslations } from 'next-intl'

/** Each row gets one colour of the ronda instead of an illustration. */
const ROWS: { key: 'month' | 'owed' | 'pot' | 'fixed'; color: string }[] = [
    { key: 'month', color: '#FFD23F' },
    { key: 'owed', color: '#B9D43A' },
    { key: 'pot', color: '#14B8B0' },
    { key: 'fixed', color: '#FF7AC6' },
]

/**
 * An example tribu drawn as an account card. Every row is something the app already shows
 * (monthly total, who pays whom, a vaquita's progress, a subscription), so the picture does not
 * promise a feature that is not there. Decorative: screen readers get the caption only.
 */
export function AccountPreview() {
    const t = useTranslations('marketing.landingPreview')

    return (
        <figure className="text-left">
            <div
                aria-hidden
                className="relative overflow-hidden rounded-3xl border-2 border-n-1 bg-n-1 p-5 text-white shadow-[4px_4px_0_#141414]"
                data-testid="landing-account-preview"
            >
                <div>
                    <p className="font-display text-xl">{t('name')}</p>
                    <p className="text-sm text-white/60">{t('people')}</p>
                </div>
                <ul className="mt-5 grid gap-2">
                    {ROWS.map(({ key, color }) => (
                        <li key={key} className="flex items-center gap-3 rounded-xl bg-white/[0.07] px-3 py-2.5">
                            <span className="size-3 shrink-0 rounded-full" style={{ backgroundColor: color }} />
                            <span className="flex flex-1 flex-wrap items-center gap-x-2 gap-y-1 text-sm text-white/80">
                                {t(`${key}Label`)}
                                {key === 'fixed' && (
                                    <span className="rounded-full bg-[#FF7AC6] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-n-1">
                                        {t('fixedChip')}
                                    </span>
                                )}
                            </span>
                            <span className="text-sm font-bold">{t(`${key}Value`)}</span>
                        </li>
                    ))}
                </ul>
                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10">
                    <div className="h-full w-[62%] rounded-full bg-primary-1" />
                </div>
            </div>
            <figcaption className="mt-2 text-center text-xs text-n-1/60">{t('label')}</figcaption>
        </figure>
    )
}

export default AccountPreview

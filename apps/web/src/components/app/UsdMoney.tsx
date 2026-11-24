'use client'

import { useLocale } from 'next-intl'
import { formatMoney } from '@/lib/money'

/**
 * Dollars written as "US$", because in Argentina a bare "$" means pesos and the patrimonio
 * screen shows both side by side.
 */
export const formatUsd = (cents: string, locale: string) =>
    formatMoney(cents, 'USD', undefined, locale).replace(/^(-?)(?:US)?\$\s?/, '$1US$ ')

export function UsdMoney({ cents, className }: { cents: string; className?: string }) {
    const locale = useLocale()
    return <span className={className}>{formatUsd(cents, locale)}</span>
}

import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { SiteFooter } from './SiteFooter'

vi.mock('next-intl', () => ({
    useLocale: () => 'es-419',
    useTranslations: () => (key: string) => key,
}))

describe('SiteFooter', () => {
    const html = renderToStaticMarkup(<SiteFooter />)

    it('links the terms page, which carries the AGPL source link', () => {
        expect(html).toContain('href="/terminos"')
    })

    it('carries no Peanut link', () => {
        expect(html).not.toMatch(/peanut\.me|squirrellabs/)
    })
})

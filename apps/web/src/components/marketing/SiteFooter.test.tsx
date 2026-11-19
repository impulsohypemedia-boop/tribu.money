import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { SiteFooter, SOURCE_URL } from './SiteFooter'

vi.mock('next-intl', () => ({
    useLocale: () => 'es-419',
    useTranslations: () => (key: string) => key,
}))

describe('SiteFooter', () => {
    const html = renderToStaticMarkup(<SiteFooter />)

    it('links the public source, as the AGPL requires for a hosted fork', () => {
        expect(html).toContain(`href="${SOURCE_URL}"`)
    })

    it('links the privacy notice', () => {
        expect(html).toContain('href="/privacy"')
    })

    it('carries no Peanut link', () => {
        expect(html).not.toMatch(/peanut\.me|squirrellabs/)
    })
})

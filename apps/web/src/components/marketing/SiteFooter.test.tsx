import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { SiteFooter, SOURCE_URL } from './SiteFooter'

vi.mock('next-intl', () => ({
    useLocale: () => 'en',
    useTranslations: () => (key: string) => key,
}))

vi.mock('@/components/ui/LocaleSwitcher', () => ({
    LocaleSwitcher: () => null,
}))

describe('SiteFooter', () => {
    const html = renderToStaticMarkup(<SiteFooter showLocaleSwitcher={false} />)

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

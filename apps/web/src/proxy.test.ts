import { NextRequest } from 'next/server'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { LOCALE_COOKIE, LOCALE_COOKIE_MAX_AGE_SECONDS } from '@/i18n/locales'
import { LOCALE_HEADER } from '@/i18n/paths'
import { SPLIT_ASSET_PREFIX } from '@/lib/domains'
import { siteUrl } from '@/lib/site'
import { config, proxy } from './proxy'

describe('proxy /new locale handoff', () => {
    it('matches identity-bearing files and APIs for alias canonicalisation', () => {
        expect(config.matcher).toContain('/sitemap.xml')
        expect(config.matcher).toContain('/robots.txt')
        expect(config.matcher).toContain('/manifest.webmanifest')
        expect(config.matcher).toContain('/sw.js')
        expect(config.matcher).toContain('/favicon.ico')
        expect(config.matcher).toContain('/icon.png')
        expect(config.matcher).toContain('/icons/:path*')
        expect(config.matcher).toContain('/api/:path*')
        expect(config.matcher).toContain(`${SPLIT_ASSET_PREFIX}/:path*`)
    })

    it('strips one trailing slash in one hop, keeping the query, before any other handling', () => {
        const response = proxy(new NextRequest('http://localhost/blog/?utm_source=chat'))

        expect(response.status).toBe(308)
        expect(response.headers.get('location')).toBe(`${siteUrl}/blog?utm_source=chat`)
    })

    it('leaves the root and doubled slashes alone, like the built-in strip it replaces', () => {
        for (const path of ['/', '/blog', '/blog//']) {
            const response = proxy(new NextRequest(`http://localhost${path}`))
            expect(response.headers.get('location'), path).toBeNull()
        }
    })

    it('matches dotted trailing-slash paths so the strip covers them too', () => {
        expect(config.matcher).toContain('/((?!api/|_next/|split-static/).*\\..*)/')
    })

    it('no longer owns a /split namespace or a renderer-only sitemap route', () => {
        expect(config.matcher).not.toContain('/split/:path*')
        expect(config.matcher).not.toContain('/:locale/split/:path*')
        expect(config.matcher).not.toContain('/split-sitemap.xml/:path*')
        expect(config.matcher.join('\n')).not.toContain('split-sitemap')
    })

    it('redirects the former host before any app or content handling', () => {
        for (const path of ['/app', '/r/trip-abc123', '/guides/synthetic-guide']) {
            const response = proxy(
                new NextRequest(`https://renderer.internal${path}?from=chat`, {
                    headers: { 'x-forwarded-host': 'app.tribu.money' },
                })
            )
            expect(response.status, path).toBe(308)
            expect(response.headers.get('location'), path).toBe(`${siteUrl}${path}?from=chat`)
        }
    })

    it('passes canonical APIs through without rewriting request headers', () => {
        const response = proxy(
            new NextRequest('https://renderer.internal/api/rooms', {
                headers: { 'x-forwarded-host': new URL(siteUrl).host, cookie: 'ps-locale=pt-br' },
            })
        )

        expect(response.status).toBe(200)
        expect(response.headers.get('location')).toBeNull()
        expect(response.headers.get(`x-middleware-request-${LOCALE_HEADER}`)).toBeNull()
    })

    it('sets first-paint locale context and persists it without redirecting or dropping query parameters', () => {
        const request = new NextRequest(
            'http://localhost/new?locale=pt-br&utm_source=tribu.money&utm_campaign=split-content'
        )

        const response = proxy(request)

        expect(response.status).toBe(200)
        expect(response.headers.get('location')).toBeNull()
        expect(response.headers.get(`x-middleware-request-${LOCALE_HEADER}`)).toBe('pt-br')
        expect(response.cookies.get(LOCALE_COOKIE)?.value).toBe('pt-br')
        expect(response.headers.get('set-cookie')).toContain(`Max-Age=${LOCALE_COOKIE_MAX_AGE_SECONDS}`)
        expect(response.headers.get('set-cookie')).toContain('Path=/')
        expect(response.headers.get('set-cookie')).toContain('SameSite=lax')
        expect(request.nextUrl.search).toBe('?locale=pt-br&utm_source=tribu.money&utm_campaign=split-content')
    })

    it('leaves invalid and absent handoffs on the existing cookie-decided path', () => {
        for (const query of ['', '?locale=es', '?locale=uk-UA']) {
            const response = proxy(new NextRequest(`http://localhost/new${query}`))

            expect(response.headers.get(`x-middleware-request-${LOCALE_HEADER}`)).toBeNull()
            expect(response.cookies.get(LOCALE_COOKIE)).toBeUndefined()
        }
    })
})

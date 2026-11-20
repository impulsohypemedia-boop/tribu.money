import { describe, expect, it } from 'vitest'
import { canonicalRedirect } from './canonical-redirect'

const OFFICIAL = 'https://tribu.money'
const SELF_HOSTED = 'https://split.example.org:8443'

describe('canonicalRedirect', () => {
    it('redirects every app.tribu.money path to the same tribu.money path permanently', () => {
        for (const path of ['/', '/app', '/new', '/import', '/r/trip-abc123', '/blog', '/manifest.webmanifest']) {
            expect(canonicalRedirect('app.tribu.money', path, '', OFFICIAL)).toEqual({
                target: `https://tribu.money${path}`,
                status: 308,
            })
        }
    })

    it('preserves query strings and canonicalises both www aliases', () => {
        expect(canonicalRedirect('www.app.tribu.money:443', '/r/trip-abc123', '?from=chat', OFFICIAL)).toEqual({
            target: 'https://tribu.money/r/trip-abc123?from=chat',
            status: 308,
        })
        expect(canonicalRedirect('WWW.TRIBU.MONEY', '/new', '?locale=pt-br', OFFICIAL)).toEqual({
            target: 'https://tribu.money/new?locale=pt-br',
            status: 308,
        })
    })

    it('serves the canonical apex and non-production hosts in place', () => {
        for (const host of ['tribu.money', 'localhost:3000', 'preview.example.com', '']) {
            expect(canonicalRedirect(host, '/app', '', OFFICIAL)).toBeNull()
        }
    })

    it('redirects every official host to a configured neutral origin without reflecting the request host', () => {
        for (const host of ['tribu.money', 'www.tribu.money', 'app.tribu.money', 'www.app.tribu.money']) {
            expect(canonicalRedirect(host, '/app', '?from=official', SELF_HOSTED)).toEqual({
                target: `${SELF_HOSTED}/app?from=official`,
                status: 308,
            })
        }
        expect(canonicalRedirect('split.example.org:8443', '/app', '', SELF_HOSTED)).toBeNull()
        expect(canonicalRedirect('split.example.org', '/app', '', SELF_HOSTED)).toEqual({
            target: `${SELF_HOSTED}/app`,
            status: 308,
        })
        expect(canonicalRedirect('attacker.example', '/app', '', SELF_HOSTED)).toBeNull()
    })

    it('collapses a legacy-alias configured origin onto the canonical apex instead of inverting', () => {
        expect(canonicalRedirect('tribu.money', '/app', '', 'https://app.tribu.money')).toBeNull()
        expect(canonicalRedirect('app.tribu.money', '/app', '?from=chat', 'https://app.tribu.money')).toEqual({
            target: 'https://tribu.money/app?from=chat',
            status: 308,
        })
    })

    it('keeps health probes host-local', () => {
        for (const host of ['app.tribu.money', 'www.app.tribu.money', 'www.tribu.money']) {
            expect(canonicalRedirect(host, '/healthcheck', '', SELF_HOSTED)).toBeNull()
            expect(canonicalRedirect(host, '/readiness', '', SELF_HOSTED)).toBeNull()
        }
    })

    it('never reflects an untrusted request host into the target', () => {
        expect(
            canonicalRedirect('app.tribu.money.evil.example', '/app', '?next=https://evil.example', SELF_HOSTED)
        ).toBeNull()
        expect(canonicalRedirect('app.tribu.money', '/app', '', 'https://attacker.example/path')).toEqual({
            target: 'https://tribu.money/app',
            status: 308,
        })
    })
})

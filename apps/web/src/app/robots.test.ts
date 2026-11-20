import { describe, expect, it } from 'vitest'
import sitemap from './sitemap'
import robots from './robots'
import { CANONICAL_ORIGIN } from '@/lib/domains'

describe('canonical discovery host', () => {
    it('keeps every sitemap and robots URL on the canonical origin', () => {
        expect(robots().sitemap).toBe(`${CANONICAL_ORIGIN}/sitemap.xml`)
        const urls = sitemap().map((entry) => new URL(String(entry.url)))
        expect(urls.length).toBeGreaterThan(0)
        for (const url of urls) expect(url.origin).toBe(CANONICAL_ORIGIN)
    })

    it('never lists a room, the importer or the room-creation form', () => {
        const paths = sitemap().map((entry) => new URL(String(entry.url)).pathname)
        for (const path of paths) expect(path).not.toMatch(/^\/(r|import|new)(\/|$)/)
    })
})

import type { MetadataRoute } from 'next'
import { absoluteUrl } from '@/lib/seo'

/** Rooms are credential-shaped and never listed; the only public pages are the landing and the terms. */
export default function sitemap(): MetadataRoute.Sitemap {
    return [
        { url: absoluteUrl('/'), changeFrequency: 'monthly', priority: 1 },
        { url: absoluteUrl('/terminos'), changeFrequency: 'yearly', priority: 0.3 },
    ]
}

/**
 * The tall stories image for a trip or a vaquita, at a path derivable from the slug so the share
 * button can fetch it. See `server/og/storyCard.tsx`.
 */
import { storyImageResponse } from '@/server/og/storyCard'
import { enforceRateLimit, LOOKUP_MISS_LIMIT, LOOKUP_MISS_SCOPE } from '@/server/rateLimit'

// Prisma + `fs` for the fonts: this cannot run on the edge.
export const runtime = 'nodejs'
// Live room state, and the build has no database — never prerender this.
export const dynamic = 'force-dynamic'

export async function GET(request: Request, { params }: { params: Promise<{ slug: string }> }) {
    const { slug } = await params
    // Only a miss spends from the guessing budget, and a drained budget still answers 200.
    return storyImageResponse(slug, () => {
        try {
            enforceRateLimit(request, LOOKUP_MISS_LIMIT, LOOKUP_MISS_SCOPE)
        } catch {
            /* budget only */
        }
    })
}

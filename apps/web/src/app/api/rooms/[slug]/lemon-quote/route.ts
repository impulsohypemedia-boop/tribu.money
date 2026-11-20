import { z } from 'zod'
import { availableStablecoins, lemonNetwork } from '@/lib/lemon/chain'
import { badRequest, respond } from '@/server/http'
import { parseMinor } from '@/server/money'
import { quoteStablecoin } from '@/server/lemon/quote'
import { WRITE_LIMIT, enforceRateLimit } from '@/server/rateLimit'
import { loadRoom } from '@/server/roomState'

export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ slug: string }> }

const querySchema = z.object({ amountMinor: z.string().regex(/^[1-9][0-9]{0,30}$/) })

/** What a debt in the room's currency is worth in each stablecoin Tribu settles in. */
export const GET = (request: Request, ctx: Ctx) =>
    respond(async () => {
        enforceRateLimit(request, WRITE_LIMIT, 'lemon-quote')
        const { slug } = await ctx.params
        const query = querySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams))
        if (!query.success) throw badRequest('amountMinor must be a positive integer')
        const room = await loadRoom(slug)
        const amountMinor = parseMinor(query.data.amountMinor)
        const network = lemonNetwork()
        const quotes = await Promise.all(
            availableStablecoins(network).map(async (token) => {
                const { usdCents, tokenAmount } = await quoteStablecoin(amountMinor, room.currency, token)
                return { token: token.symbol, address: token.address, decimals: token.decimals, usdCents, tokenAmount }
            })
        )
        return { chainId: network.chainId, quotes }
    })

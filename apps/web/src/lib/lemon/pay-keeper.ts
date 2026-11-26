'use client'

import { api } from '@/lib/api'
import { lemonNetwork, type StablecoinSymbol } from './chain'
import { payStablecoin, type StablecoinPaymentResult } from './client'

/**
 * Send money to a pot's keeper from inside Lemon: a round-up or a fine. Unlike a settle-up, the
 * pot contribution that follows is recorded on the payer's word, as every pot contribution is.
 */
export async function payKeeperWithLemon(input: {
    slug: string
    amountMinor: string
    keeperWallet: string
    stablecoin: StablecoinSymbol
    title: string
}): Promise<StablecoinPaymentResult> {
    const config = lemonNetwork().tokens[input.stablecoin]
    const quote = (await api.lemonQuote(input.slug, input.amountMinor)).quotes.find(
        (candidate) => candidate.token === input.stablecoin
    )
    if (!config || !quote) return { status: 'failed', message: 'lemon payment unavailable' }
    return payStablecoin({ token: config, to: input.keeperWallet, tokenAmount: quote.tokenAmount, title: input.title })
}

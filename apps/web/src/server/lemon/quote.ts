import type { StablecoinConfig } from '@/lib/lemon/chain'
import { usdCentsToTokenUnits } from '@/lib/lemon/chain'
import { convertMinor } from '@/server/fx'

/** What a room-currency debt is worth in a dollar stablecoin right now, at the room's FX source. */
export async function quoteStablecoin(
    amountMinor: bigint,
    roomCurrency: string,
    token: StablecoinConfig
): Promise<{ usdCents: bigint; tokenAmount: bigint }> {
    const usdCents = await convertMinor(amountMinor, roomCurrency, 'USD')
    return { usdCents, tokenAmount: usdCentsToTokenUnits(usdCents, token) }
}

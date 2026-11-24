import { respond } from '@/server/http'
import { getUsdRates } from '@/server/usd-rates'

export const dynamic = 'force-dynamic'

/** Indicative dollar values for the patrimonio screen. Never used to price money. */
export const GET = () => respond(async () => ({ ...(await getUsdRates()), indicative: true }))

import { createPublicClient, http, type PublicClient } from 'viem'
import { polygon, polygonAmoy } from 'viem/chains'
import { lemonNetwork, type LemonNetwork } from '@/lib/lemon/chain'

/**
 * The read-only chain client used to check Lemon signatures and payments.
 *
 * `TRIBU_RPC_URL` should point at a provider with an SLA in production; the public endpoint viem
 * ships for each chain is rate-limited and is only a development default.
 */
let cached: { key: string; client: PublicClient } | null = null

export function chainClient(network: LemonNetwork = lemonNetwork()): PublicClient {
    const url = process.env.TRIBU_RPC_URL || undefined
    const key = `${network.key}|${url ?? ''}`
    if (cached?.key === key) return cached.client
    const chain = network.key === 'polygon-amoy' ? polygonAmoy : polygon
    const client = createPublicClient({ chain, transport: http(url) }) as PublicClient
    cached = { key, client }
    return client
}

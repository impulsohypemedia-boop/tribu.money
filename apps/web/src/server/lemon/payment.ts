import { decodeEventLog, parseAbi, type Log } from 'viem'
import { lemonNetwork, sameAddress, type LemonNetwork, type StablecoinConfig } from '@/lib/lemon/chain'
import { badRequest, conflict } from '@/server/http'

const ERC20_TRANSFER = parseAbi(['event Transfer(address indexed from, address indexed to, uint256 value)'])

/**
 * How far the on-chain amount may fall short of the quote. Covers the exchange rate moving between
 * the quote on the payer's screen and the check here; it never lets a different token or recipient
 * through.
 */
export const QUOTE_TOLERANCE_BPS = 200n

export interface ReceiptLike {
    status: 'success' | 'reverted'
    logs: readonly Pick<Log, 'address' | 'data' | 'topics'>[]
}

/** Returns null while the transaction is not yet mined. */
export type ReceiptReader = (hash: `0x${string}`) => Promise<ReceiptLike | null>

export interface ExpectedPayment {
    txHash: string
    token: StablecoinConfig
    from: string
    to: string
    /** What the payer's screen promised, in token base units. */
    tokenAmount: bigint
    /** What the server's own quote says the debt is worth now, in token base units. */
    quotedAmount: bigint
}

/**
 * Confirms that `txHash` moved at least the promised amount of the chosen stablecoin from the
 * payer's wallet to the payee's wallet. Throws a retryable 409 while the transaction is pending and
 * a 400 for anything that does not match, so the settlement is never recorded on a promise.
 */
export async function verifyStablecoinPayment(
    expected: ExpectedPayment,
    readReceipt: ReceiptReader,
    network: LemonNetwork = lemonNetwork()
): Promise<void> {
    if (!/^0x[0-9a-fA-F]{64}$/.test(expected.txHash)) {
        throw badRequest('transaction hash is malformed', 'LEMON_TX_INVALID')
    }
    const floor = expected.quotedAmount - (expected.quotedAmount * QUOTE_TOLERANCE_BPS) / 10_000n
    if (expected.tokenAmount < floor) {
        throw badRequest('payment is below the current value of the debt', 'LEMON_TX_UNDERPAID')
    }
    if (
        !network.tokens[expected.token.symbol] ||
        !sameAddress(network.tokens[expected.token.symbol]?.address, expected.token.address)
    ) {
        throw badRequest('token is not offered on this network', 'LEMON_TX_INVALID')
    }

    const receipt = await readReceipt(expected.txHash as `0x${string}`)
    if (!receipt) throw conflict('the payment is still being confirmed', 'LEMON_TX_PENDING')
    if (receipt.status !== 'success') throw badRequest('the payment transaction failed', 'LEMON_TX_FAILED')

    let moved = 0n
    for (const log of receipt.logs) {
        if (!sameAddress(log.address, expected.token.address)) continue
        try {
            const event = decodeEventLog({ abi: ERC20_TRANSFER, data: log.data, topics: log.topics as never })
            if (sameAddress(event.args.from, expected.from) && sameAddress(event.args.to, expected.to)) {
                moved += event.args.value
            }
        } catch {
            // Not a Transfer event from this token; ignore it.
        }
    }
    if (moved === 0n) throw badRequest('no matching transfer in that transaction', 'LEMON_TX_MISMATCH')
    if (moved < expected.tokenAmount) throw badRequest('the transfer moved less than promised', 'LEMON_TX_UNDERPAID')
}

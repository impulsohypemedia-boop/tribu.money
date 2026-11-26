import { describe, expect, it } from 'vitest'
import { encodeAbiParameters, encodeEventTopics, parseAbi } from 'viem'
import { lemonNetwork } from '@/lib/lemon/chain'
import { verifyStablecoinPayment, type ReceiptLike } from './payment'

const network = lemonNetwork('polygon')
const USDC = network.tokens.USDC!
const USDT = network.tokens.USDT!
const PAYER = '0x1111111111111111111111111111111111111111'
const PAYEE = '0x2222222222222222222222222222222222222222'
const HASH = `0x${'ab'.repeat(32)}`
const abi = parseAbi(['event Transfer(address indexed from, address indexed to, uint256 value)'])

function transferLog(token: string, from: string, to: string, value: bigint) {
    return {
        address: token as `0x${string}`,
        topics: encodeEventTopics({
            abi,
            eventName: 'Transfer',
            args: { from: from as `0x${string}`, to: to as `0x${string}` },
        }) as [`0x${string}`, ...`0x${string}`[]],
        data: encodeAbiParameters([{ type: 'uint256' }], [value]),
    }
}

const receipt =
    (logs: ReceiptLike['logs'], status: ReceiptLike['status'] = 'success') =>
    async () => ({ status, logs })

const expected = {
    txHash: HASH,
    token: USDC,
    from: PAYER,
    to: PAYEE,
    tokenAmount: 12_500_000n,
    quotedAmount: 12_500_000n,
}

describe('verifyStablecoinPayment', () => {
    it('accepts the exact transfer the payer promised', async () => {
        await expect(
            verifyStablecoinPayment(expected, receipt([transferLog(USDC.address, PAYER, PAYEE, 12_500_000n)]), network)
        ).resolves.toBeUndefined()
    })

    it('compares addresses case-insensitively', async () => {
        await expect(
            verifyStablecoinPayment(
                { ...expected, to: PAYEE.toUpperCase().replace('0X', '0x') },
                receipt([transferLog(USDC.address, PAYER, PAYEE, 12_500_000n)]),
                network
            )
        ).resolves.toBeUndefined()
    })

    it('says pending, retryably, while the transaction is not mined', async () => {
        await expect(verifyStablecoinPayment(expected, async () => null, network)).rejects.toMatchObject({
            code: 'LEMON_TX_PENDING',
            status: 409,
        })
    })

    it('rejects a reverted transaction', async () => {
        await expect(
            verifyStablecoinPayment(
                expected,
                receipt([transferLog(USDC.address, PAYER, PAYEE, 12_500_000n)], 'reverted'),
                network
            )
        ).rejects.toMatchObject({ code: 'LEMON_TX_FAILED' })
    })

    it('rejects a transfer of the other stablecoin', async () => {
        await expect(
            verifyStablecoinPayment(expected, receipt([transferLog(USDT.address, PAYER, PAYEE, 12_500_000n)]), network)
        ).rejects.toMatchObject({ code: 'LEMON_TX_MISMATCH' })
    })

    it('rejects a transfer to someone else', async () => {
        const stranger = '0x3333333333333333333333333333333333333333'
        await expect(
            verifyStablecoinPayment(
                expected,
                receipt([transferLog(USDC.address, PAYER, stranger, 12_500_000n)]),
                network
            )
        ).rejects.toMatchObject({ code: 'LEMON_TX_MISMATCH' })
    })

    it('rejects a transfer from someone other than the payer', async () => {
        const stranger = '0x3333333333333333333333333333333333333333'
        await expect(
            verifyStablecoinPayment(
                expected,
                receipt([transferLog(USDC.address, stranger, PAYEE, 12_500_000n)]),
                network
            )
        ).rejects.toMatchObject({ code: 'LEMON_TX_MISMATCH' })
    })

    it('rejects a transfer smaller than promised', async () => {
        await expect(
            verifyStablecoinPayment(expected, receipt([transferLog(USDC.address, PAYER, PAYEE, 12_000_000n)]), network)
        ).rejects.toMatchObject({ code: 'LEMON_TX_UNDERPAID' })
    })

    it('rejects a promise well below the current quote, before reading the chain', async () => {
        let read = false
        await expect(
            verifyStablecoinPayment(
                { ...expected, tokenAmount: 10_000_000n },
                async () => {
                    read = true
                    return null
                },
                network
            )
        ).rejects.toMatchObject({ code: 'LEMON_TX_UNDERPAID' })
        expect(read).toBe(false)
    })

    it('tolerates a quote that moved by less than two percent', async () => {
        await expect(
            verifyStablecoinPayment(
                { ...expected, tokenAmount: 12_300_000n },
                receipt([transferLog(USDC.address, PAYER, PAYEE, 12_300_000n)]),
                network
            )
        ).resolves.toBeUndefined()
    })

    it('rejects a malformed hash', async () => {
        await expect(
            verifyStablecoinPayment({ ...expected, txHash: '0x12' }, async () => null, network)
        ).rejects.toMatchObject({
            code: 'LEMON_TX_INVALID',
        })
    })
})

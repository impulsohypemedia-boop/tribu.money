import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto'
import { parseSiweMessage } from 'viem/siwe'
import { isAddress, lemonNetwork } from '@/lib/lemon/chain'
import { badRequest } from '@/server/http'

/**
 * Proof that a wallet belongs to whoever is linking it.
 *
 * Lemon's `authenticate` returns a Sign-In with Ethereum message signed by the user's wallet. The
 * nonce inside it is minted here and is stateless: a timestamp, a random part, and an HMAC over
 * both. That keeps the server free of a nonce table while still refusing a message Tribu did not
 * ask for, or one older than a day.
 *
 * Lemon requires an alphanumeric nonce of at least 8 characters, so everything is base36.
 */

const NONCE_TTL_MS = 24 * 60 * 60 * 1000
const MAC_LENGTH = 16

function secret(): string {
    const value = process.env.TRIBU_LEMON_NONCE_SECRET
    if (value && value.length >= 32) return value
    if (process.env.NODE_ENV === 'production') {
        throw new Error('TRIBU_LEMON_NONCE_SECRET must be set to at least 32 characters in production')
    }
    return 'development-only-nonce-secret-not-for-production'
}

function mac(body: string): string {
    const digest = createHmac('sha256', secret()).update(body).digest()
    return BigInt(`0x${digest.toString('hex')}`)
        .toString(36)
        .slice(0, MAC_LENGTH)
        .padStart(MAC_LENGTH, '0')
}

export function mintNonce(now: number = Date.now()): string {
    const time = now.toString(36).padStart(9, '0')
    const random = BigInt(`0x${randomBytes(8).toString('hex')}`)
        .toString(36)
        .padStart(13, '0')
    const body = `${time}${random}`
    return `${body}${mac(body)}`
}

export function nonceIsValid(nonce: string, now: number = Date.now()): boolean {
    if (!/^[0-9a-z]{38}$/.test(nonce)) return false
    const body = nonce.slice(0, -MAC_LENGTH)
    const given = Buffer.from(nonce.slice(-MAC_LENGTH))
    const expected = Buffer.from(mac(body))
    if (!timingSafeEqual(given, expected)) return false
    const issued = parseInt(body.slice(0, 9), 36)
    return issued <= now + 60_000 && now - issued <= NONCE_TTL_MS
}

export interface WalletProof {
    wallet: string
    message: string
    signature: string
}

/** Checks a signature against the wallet, including undeployed smart wallets (ERC-6492). */
export type SignatureVerifier = (input: {
    address: `0x${string}`
    message: string
    signature: `0x${string}`
}) => Promise<boolean>

/**
 * Returns the lowercase wallet address once the message is one Tribu issued, names that wallet and
 * the configured chain, and carries a valid signature from it. Throws a 400 otherwise.
 */
export async function verifyWalletProof(
    proof: WalletProof,
    verify: SignatureVerifier,
    now: number = Date.now()
): Promise<string> {
    if (!isAddress(proof.wallet)) throw badRequest('wallet is not an address', 'LEMON_PROOF_INVALID')
    if (!/^0x[0-9a-fA-F]+$/.test(proof.signature)) throw badRequest('signature is not hex', 'LEMON_PROOF_INVALID')

    const fields = parseSiweMessage(proof.message)
    if (!fields.nonce || !nonceIsValid(fields.nonce, now)) {
        throw badRequest('sign-in message is stale or was not issued by Tribu', 'LEMON_PROOF_STALE')
    }
    if (!fields.address || fields.address.toLowerCase() !== proof.wallet.toLowerCase()) {
        throw badRequest('sign-in message names another wallet', 'LEMON_PROOF_INVALID')
    }
    if (fields.chainId !== undefined && fields.chainId !== lemonNetwork().chainId) {
        throw badRequest('sign-in message is for another chain', 'LEMON_PROOF_INVALID')
    }
    if (fields.expirationTime && fields.expirationTime.getTime() < now) {
        throw badRequest('sign-in message has expired', 'LEMON_PROOF_STALE')
    }

    const valid = await verify({
        address: proof.wallet as `0x${string}`,
        message: proof.message,
        signature: proof.signature as `0x${string}`,
    })
    if (!valid) throw badRequest('signature does not match the wallet', 'LEMON_PROOF_INVALID')
    return proof.wallet.toLowerCase()
}

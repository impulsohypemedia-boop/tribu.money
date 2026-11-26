import { describe, expect, it } from 'vitest'
import { verifyMessage } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { createSiweMessage } from 'viem/siwe'
import { mintNonce, nonceIsValid, verifyWalletProof } from './identity'

const account = privateKeyToAccount('0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d')
const other = privateKeyToAccount('0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a')
const verify = (input: { address: `0x${string}`; message: string; signature: `0x${string}` }) => verifyMessage(input)

async function proof(nonce: string, signer = account, chainId = 137) {
    const message = createSiweMessage({
        address: account.address,
        chainId,
        domain: 'tribu.money',
        nonce,
        uri: 'https://tribu.money',
        version: '1',
    })
    return { wallet: account.address, message, signature: await signer.signMessage({ message }) }
}

describe('Lemon sign-in nonce', () => {
    it('is alphanumeric and long enough for Lemon', () => {
        const nonce = mintNonce()
        expect(nonce).toMatch(/^[0-9a-z]{38}$/)
        expect(nonceIsValid(nonce)).toBe(true)
    })

    it('rejects a tampered nonce', () => {
        const nonce = mintNonce()
        const flipped = nonce.slice(0, 10) + (nonce[10] === 'a' ? 'b' : 'a') + nonce.slice(11)
        expect(nonceIsValid(flipped)).toBe(false)
    })

    it('expires after a day', () => {
        const issued = Date.UTC(2026, 10, 19)
        const nonce = mintNonce(issued)
        expect(nonceIsValid(nonce, issued + 23 * 3600_000)).toBe(true)
        expect(nonceIsValid(nonce, issued + 25 * 3600_000)).toBe(false)
    })
})

describe('verifyWalletProof', () => {
    it('accepts a message Tribu issued, signed by the wallet it names', async () => {
        await expect(verifyWalletProof(await proof(mintNonce()), verify)).resolves.toBe(account.address.toLowerCase())
    })

    it('rejects a signature from another wallet', async () => {
        await expect(verifyWalletProof(await proof(mintNonce(), other), verify)).rejects.toMatchObject({
            code: 'LEMON_PROOF_INVALID',
        })
    })

    it('rejects a nonce Tribu did not mint', async () => {
        await expect(verifyWalletProof(await proof('abcdefgh12345678'), verify)).rejects.toMatchObject({
            code: 'LEMON_PROOF_STALE',
        })
    })

    it('rejects a message for another chain', async () => {
        await expect(verifyWalletProof(await proof(mintNonce(), account, 1), verify)).rejects.toMatchObject({
            code: 'LEMON_PROOF_INVALID',
        })
    })

    it('rejects a proof whose wallet differs from the signed message', async () => {
        const signed = await proof(mintNonce())
        await expect(verifyWalletProof({ ...signed, wallet: other.address }, verify)).rejects.toMatchObject({
            code: 'LEMON_PROOF_INVALID',
        })
    })
})

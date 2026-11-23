/**
 * La ruleta de la cuenta: who covers the whole bill, picked by a draw anyone can check.
 *
 * The server draws a secret seed and shows its SHA-256 before the spin. At the spin the phone adds
 * its own seed, and the winner is the hash of both seeds and the sorted list of who was in, taken
 * modulo the number of people. The server cannot steer it (its seed was fixed first) and the phone
 * cannot either (it never saw the server's seed). This file runs on both sides, so the phone can
 * redo the sum after the server reveals its seed.
 */

const hex = (bytes: ArrayBuffer) => [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, '0')).join('')

export async function sha256Hex(text: string): Promise<string> {
    return hex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)))
}

/** The text that is hashed, written out so anyone can repeat it by hand. */
export const drawInput = (seed: string, clientSeed: string, participantIds: readonly string[]) =>
    `${seed}:${clientSeed}:${[...participantIds].sort().join(',')}`

export async function drawWinner(
    seed: string,
    clientSeed: string,
    participantIds: readonly string[]
): Promise<{ winnerId: string; hash: string }> {
    if (participantIds.length === 0) throw new Error('a draw needs someone in it')
    const sorted = [...participantIds].sort()
    const hash = await sha256Hex(drawInput(seed, clientSeed, sorted))
    const index = Number(BigInt(`0x${hash}`) % BigInt(sorted.length))
    return { winnerId: sorted[index], hash }
}

/** True when the revealed seed matches the hash shown before the spin and the winner follows from it. */
export async function verifyDraw(draw: {
    seed: string
    seedHash: string
    clientSeed: string
    participantIds: readonly string[]
    winnerId: string
}): Promise<boolean> {
    if ((await sha256Hex(draw.seed)) !== draw.seedHash) return false
    const { winnerId } = await drawWinner(draw.seed, draw.clientSeed, draw.participantIds)
    return winnerId === draw.winnerId
}

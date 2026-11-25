import fede from '@/assets/ronda/fede.svg'
import olvi from '@/assets/ronda/olvi.svg'
import paco from '@/assets/ronda/paco.svg'
import ruli from '@/assets/ronda/ruli.svg'
import tano from '@/assets/ronda/tano.svg'
import tita from '@/assets/ronda/tita.svg'
import { RONDA_KEYS, type RondaKey } from './avatars'

export const RONDA_HEADS = { paco, olvi, tano, tita, fede, ruli } as const

const isRondaKey = (value: string | null | undefined): value is RondaKey =>
    typeof value === 'string' && (RONDA_KEYS as readonly string[]).includes(value)

/** FNV-1a: a stable, dependency-free string hash. */
function hash(value: string): number {
    let h = 0x811c9dc5
    for (let i = 0; i < value.length; i++) {
        h ^= value.charCodeAt(i)
        h = Math.imul(h, 0x01000193)
    }
    return h >>> 0
}

/**
 * Which Ronda character draws a member. A cast key draws itself. Any older key (or none) maps
 * to a character by a stable hash of the key, falling back to the name, so rows that predate the
 * cast get a new character without a data migration and keep it on every device.
 */
export function rondaFor(avatar: string | null | undefined, name: string): RondaKey {
    if (isRondaKey(avatar)) return avatar
    return RONDA_KEYS[hash(avatar ?? name) % RONDA_KEYS.length]
}

/**
 * The alter-ego catalog. These tests pin the product rule, not SVG pixels:
 * defaults are persisted and non-human, the picker offers real breadth, old
 * stored keys remain readable, and the database allowlist stays an allowlist.
 */
import { describe, expect, it } from 'vitest'
import { DOODLE } from '@/components/ui/doodles'
import {
    AVATARS,
    AVATAR_KEYS,
    CLASSIC_AVATARS,
    FALLBACK_AVATAR,
    PERSONAS,
    PERSONA_KEYS,
    RONDA_KEYS,
    avatarArt,
    avatarFamily,
    dealPersonaKeys,
    isAvatarKey,
    randomPersonaKey,
} from './avatars'

const isRondaKey = (key: string) => (RONDA_KEYS as readonly string[]).includes(key)

describe('the default alter ego', () => {
    it('draws from the Ronda cast', () => {
        expect(randomPersonaKey(null, () => 0)).toBe('paco')
        expect(randomPersonaKey(null, () => 0.999999)).toBe('ruli')
    })

    it('excludes the current character when somebody rolls again', () => {
        expect(randomPersonaKey('paco', () => 0)).toBe('olvi')
        expect(randomPersonaKey('ruli', () => 0.999999)).toBe('fede')
    })

    it('excludes every character already used by a room, and reuses one once all six are taken', () => {
        expect(randomPersonaKey(['paco', 'olvi', 'tano'], () => 0)).toBe('tita')
        expect(randomPersonaKey([...RONDA_KEYS], () => 0)).toBe('paco')
    })

    it('ignores older keys when choosing, because they are drawn as the cast anyway', () => {
        expect(randomPersonaKey(['vampire-penguin', 'ninja-pear'], () => 0)).toBe('paco')
    })

    it('deals a distinct cast for a whole roster, the Ronda first', () => {
        for (const count of [0, 1, 6, 7, 20, PERSONA_KEYS.length]) {
            const dealt = dealPersonaKeys(count, () => 0.42)
            expect(dealt).toHaveLength(count)
            expect(new Set(dealt).size).toBe(count)
            expect(dealt.every((key) => PERSONA_KEYS.includes(key))).toBe(true)
            expect(dealt.slice(0, Math.min(count, RONDA_KEYS.length)).every((key) => isRondaKey(key))).toBe(true)
        }
    })

    it('refuses impossible roster deals', () => {
        for (const count of [-1, 1.5, PERSONA_KEYS.length + 1]) {
            expect(() => dealPersonaKeys(count)).toThrow(RangeError)
        }
    })
})

describe('the catalog', () => {
    it('offers the six Ronda characters and keeps the older cast readable', () => {
        expect(AVATAR_KEYS).toEqual([...RONDA_KEYS])
        expect(PERSONA_KEYS).toHaveLength(42)
    })

    it('keeps the older characters under their stored keys', () => {
        expect(PERSONAS['vampire-penguin'].label).toBe('Vampire Penguin')
        expect(PERSONAS['pirate-parrot'].label).toBe('Pirate Parrot')
        expect(PERSONAS['punk-pineapple'].label).toBe('Punk Pineapple')
    })

    it('has unique names and vibes, and a unique drawing for every older character', () => {
        expect(new Set(PERSONA_KEYS.map((key) => PERSONAS[key].label)).size).toBe(PERSONA_KEYS.length)
        expect(new Set(PERSONA_KEYS.map((key) => PERSONAS[key].vibe)).size).toBe(PERSONA_KEYS.length)
        const older = PERSONA_KEYS.filter((key) => !isRondaKey(key))
        expect(new Set(older.map((key) => PERSONAS[key].doodle)).size).toBe(older.length)
    })

    it('keeps every card description within the two lines the picker gives it', () => {
        for (const key of AVATAR_KEYS) {
            expect(AVATARS[key].vibe.length, `${key}: ${AVATARS[key].vibe}`).toBeLessThanOrEqual(26)
        }
    })

    it('points every option at a real fallback drawing and a complete color palette', () => {
        for (const key of AVATAR_KEYS) {
            const art = AVATARS[key]
            expect(DOODLE[art.doodle], key).toBeTruthy()
            for (const color of [art.background, art.accent, art.ink]) {
                expect(color, `${key}: ${color}`).toMatch(/^#[0-9A-F]{6}$/i)
            }
        }
        expect(Object.keys(CLASSIC_AVATARS)).toHaveLength(12)
    })

    it('does not show the old human face keys in the picker', () => {
        expect(AVATAR_KEYS.some((key) => key.startsWith('face-'))).toBe(false)
    })
})

describe('compatibility and validation', () => {
    it('accepts every picker key and rejects prototype keys and near misses', () => {
        for (const key of AVATAR_KEYS) expect(isAvatarKey(key)).toBe(true)
        for (const value of [
            'constructor',
            'toString',
            '__proto__',
            'hasOwnProperty',
            'vampire-penguin ',
            'VAMPIRE-PENGUIN',
            'mountain',
            '',
            null,
            undefined,
            42,
            {},
        ]) {
            expect(isAvatarKey(value), String(value)).toBe(false)
        }
    })

    it('redraws every legacy human-face key as a persona without reoffering it', () => {
        for (const key of [
            'face-swoop',
            'face-bob',
            'face-crop',
            'face-long',
            'face-bun',
            'face-curls',
            'face-cap',
            'face-beard',
            'face-bald',
        ]) {
            expect(isAvatarKey(key)).toBe(true)
            expect(avatarArt(key, 'Ana').kind).toBe('persona')
            expect(AVATAR_KEYS).not.toContain(key)
        }
    })

    it('redraws first-release persona keys without reoffering the less charming glyphs', () => {
        for (const key of ['ninja-pear', 'sleepy-cloud', 'karaoke-kiwi', 'cosmic-llama']) {
            expect(isAvatarKey(key)).toBe(true)
            expect(avatarArt(key, 'Ana').kind).toBe('persona')
            expect(AVATAR_KEYS).not.toContain(key)
        }
    })

    it('keeps the six resurrected first-release keys readable without reoffering them', () => {
        for (const key of [
            'detective-raccoon',
            'dj-dinosaur',
            'gamer-cat',
            'bookworm-bat',
            'trickster-fox',
            'punk-pineapple',
        ]) {
            expect(isAvatarKey(key)).toBe(true)
            expect(AVATAR_KEYS).not.toContain(key)
        }
    })

    it('draws a known pick and safely defaults null, undefined and retired junk', () => {
        expect(avatarArt('vampire-penguin', 'Ana')).toEqual(PERSONAS['vampire-penguin'])
        expect(avatarArt('doodle-dog', 'Ana')).toEqual(AVATARS['doodle-dog'])
        expect(avatarArt(null, 'Ana')).toEqual(FALLBACK_AVATAR)
        expect(avatarArt(undefined, 'Bruno')).toEqual(FALLBACK_AVATAR)
        expect(avatarArt('retired-in-2027', 'Cleo')).toEqual(FALLBACK_AVATAR)
    })
})

describe('avatarFamily — what analytics is allowed to know', () => {
    it('reports only the broad family and never a key or target member', () => {
        expect(avatarFamily('vampire-penguin')).toBe('persona')
        expect(avatarFamily('face-bun')).toBe('persona')
        expect(avatarFamily('doodle-dog')).toBe('doodle')
        expect(avatarFamily(null)).toBe('default')
        expect(avatarFamily('something-else')).toBe('default')
    })
})

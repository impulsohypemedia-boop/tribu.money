import { describe, expect, it } from 'vitest'
import { SESSION_COOKIE, readSession, sameOriginWrite, sessionFromRequest, signSession } from './session'

const USER = '0b7e3c1a-2f4d-4a8b-9c6e-1d2f3a4b5c6d'

describe('session cookie', () => {
    it('reads back the account it was signed for', () => {
        expect(readSession(signSession(USER))).toBe(USER)
    })

    it('refuses a tampered account id or signature', () => {
        const value = signSession(USER)
        const other = '1b7e3c1a-2f4d-4a8b-9c6e-1d2f3a4b5c6d'
        expect(readSession(value.replace(USER, other))).toBeNull()
        expect(readSession(`${value.slice(0, -2)}xx`)).toBeNull()
        expect(readSession('garbage')).toBeNull()
        expect(readSession(null)).toBeNull()
    })

    it('expires after a year', () => {
        const issued = Date.UTC(2026, 0, 1)
        const value = signSession(USER, issued)
        expect(readSession(value, issued + 364 * 86_400_000)).toBe(USER)
        expect(readSession(value, issued + 366 * 86_400_000)).toBeNull()
    })

    it('is found among other cookies on a request', () => {
        const request = new Request('https://tribu.money/api/account', {
            headers: { cookie: `device-id=abc; ${SESSION_COOKIE}=${signSession(USER)}; x=1` },
        })
        expect(sessionFromRequest(request)).toBe(USER)
    })
})

describe('same-origin writes', () => {
    const post = (origin: string | null) =>
        new Request('https://tribu.money/api/account/session', {
            method: 'POST',
            headers: { host: 'tribu.money', ...(origin ? { origin } : {}) },
        })

    it('accepts the site itself and requests without an Origin', () => {
        expect(sameOriginWrite(post('https://tribu.money'))).toBe(true)
        expect(sameOriginWrite(post(null))).toBe(true)
    })

    it('refuses another site', () => {
        expect(sameOriginWrite(post('https://evil.example'))).toBe(false)
    })
})

import { createHmac, timingSafeEqual } from 'node:crypto'

/**
 * The signed-in cookie. It carries only the account id and when it was issued, with an HMAC over
 * both, so the server needs no session table. Signing out clears the cookie on that device.
 */

export const SESSION_COOKIE = 'tribu-session'
/** A year: people open Tribu a few times a month and should not have to sign in each time. */
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 365

function secret(): string {
    const value = process.env.TRIBU_SESSION_SECRET
    if (value && value.length >= 32) return value
    if (process.env.NODE_ENV === 'production') {
        throw new Error('TRIBU_SESSION_SECRET must be set to at least 32 characters in production')
    }
    return 'development-only-session-secret-not-for-production'
}

const mac = (body: string): string => createHmac('sha256', secret()).update(body).digest('base64url')

export function signSession(userId: string, now: number = Date.now()): string {
    const body = `${userId}.${now.toString(36)}`
    return `${body}.${mac(body)}`
}

/** The account id inside a cookie value Tribu signed and that has not expired, or null. */
export function readSession(value: string | null | undefined, now: number = Date.now()): string | null {
    if (!value) return null
    const parts = value.split('.')
    if (parts.length !== 3) return null
    const [userId, issued, signature] = parts
    if (!/^[0-9a-f-]{36}$/.test(userId) || !/^[0-9a-z]{1,12}$/.test(issued)) return null
    const given = Buffer.from(signature)
    const expected = Buffer.from(mac(`${userId}.${issued}`))
    if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null
    const issuedAt = parseInt(issued, 36)
    if (issuedAt > now + 60_000 || now - issuedAt > SESSION_MAX_AGE_SECONDS * 1000) return null
    return userId
}

export function sessionFromRequest(request: Request): string | null {
    const header = request.headers.get('cookie')
    if (!header) return null
    for (const part of header.split(';')) {
        const [name, ...rest] = part.trim().split('=')
        if (name === SESSION_COOKIE) return readSession(decodeURIComponent(rest.join('=')))
    }
    return null
}

function cookie(value: string, maxAge: number, secure: boolean): string {
    return `${SESSION_COOKIE}=${value}; Path=/; Max-Age=${maxAge}; HttpOnly; SameSite=Lax${secure ? '; Secure' : ''}`
}

const isSecure = (request: Request): boolean =>
    new URL(request.url).protocol === 'https:' || request.headers.get('x-forwarded-proto') === 'https'

export const sessionCookie = (request: Request, userId: string): string =>
    cookie(signSession(userId), SESSION_MAX_AGE_SECONDS, isSecure(request))

export const clearedSessionCookie = (request: Request): string => cookie('', 0, isSecure(request))

/**
 * Cookie-authenticated writes refuse cross-site callers. SameSite=Lax already keeps the cookie off
 * cross-site POSTs; this also refuses a request whose Origin names another site.
 */
export function sameOriginWrite(request: Request): boolean {
    const origin = request.headers.get('origin')
    if (!origin) return true
    const host = request.headers.get('x-forwarded-host') ?? request.headers.get('host')
    try {
        return new URL(origin).host === host
    } catch {
        return false
    }
}

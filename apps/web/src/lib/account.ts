/**
 * Tribu accounts on the client.
 *
 * Sign-in itself happens at Supabase Auth with Google; this file only builds the redirect and reads
 * what Supabase sends back, so no SDK is needed. The access token it gets back is handed
 * once to `/api/account/session`, which answers with Tribu's own cookie.
 *
 * Once signed in, the device and the account swap tribus: the member tokens this device holds are
 * attached to the account, and any tribu the account has that this device lacks is written into
 * the same localStorage records a link-join would have written.
 */

import type { AccountMembership } from './api-types'
import { MEMBER_KEY_PREFIX, readIdentity, writeIdentity } from './identity'
import { readRecentRooms, rememberRoom } from './recent-rooms'

export function supabaseConfig(): { url: string; key: string } | null {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    if (!url || !key) return null
    return { url: url.replace(/\/+$/, ''), key }
}

/** Where to send the browser for "Seguir con Google". Supabase comes back to `returnTo` with the
 *  access token in the URL fragment. */
export function googleSignInUrl(returnTo: string): string | null {
    const config = supabaseConfig()
    if (!config) return null
    const params = new URLSearchParams({ provider: 'google', redirect_to: returnTo })
    return `${config.url}/auth/v1/authorize?${params.toString()}`
}

/** Reads the access token (or the error) Supabase put in the fragment after Google. */
export function readAuthFragment(hash: string): { accessToken: string } | { error: string } | null {
    const fragment = new URLSearchParams(hash.replace(/^#/, ''))
    const accessToken = fragment.get('access_token')
    if (accessToken) return { accessToken }
    const error = fragment.get('error_description') ?? fragment.get('error')
    return error ? { error } : null
}

/** Every tribu this device can act in, as the slug and the member token that proves it. */
export function heldMemberships(): Array<{ slug: string; token: string }> {
    if (typeof window === 'undefined') return []
    let store: Storage
    try {
        store = window.localStorage
    } catch {
        return []
    }
    const held: Array<{ slug: string; token: string }> = []
    try {
        for (let index = 0; index < store.length; index += 1) {
            const key = store.key(index)
            if (!key?.startsWith(MEMBER_KEY_PREFIX)) continue
            const slug = key.slice(MEMBER_KEY_PREFIX.length)
            const identity = readIdentity(slug)
            if (identity?.token) held.push({ slug, token: identity.token })
        }
    } catch {
        return held
    }
    return held
}

/**
 * Write the account's tribus this device does not know yet. A tribu where this device already acts
 * as someone keeps that identity. Returns how many tribus were added.
 */
export function adoptMemberships(memberships: AccountMembership[]): number {
    const known = new Set(readRecentRooms().map((room) => room.slug))
    let added = 0
    // Oldest first, so the newest ends up at the top of the recent list.
    for (const membership of [...memberships].reverse()) {
        if (!readIdentity(membership.slug)) {
            writeIdentity(membership.slug, {
                memberId: membership.memberId,
                name: membership.name,
                token: membership.token,
            })
        }
        if (known.has(membership.slug)) continue
        const remembered = rememberRoom({
            slug: membership.slug,
            name: membership.roomName,
            emoji: membership.emoji ?? undefined,
            theme: membership.theme ?? undefined,
            ...(membership.kind === 'vaquita' ? { kind: 'vaquita' as const } : {}),
        })
        if (remembered) added += 1
    }
    return added
}

/** Fired after account sync adds tribus, so screens listing them can read the device again. */
export const ACCOUNT_ROOMS_EVENT = 'tribu:account-rooms'

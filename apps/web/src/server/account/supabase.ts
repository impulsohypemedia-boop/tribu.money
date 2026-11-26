import { ApiError } from '@/server/http'

/**
 * Supabase Auth runs the sign-in itself (Google, or a code by email). Tribu only asks Supabase who
 * an access token belongs to, once, and then issues its own cookie. Nothing else in Tribu talks to
 * Supabase Auth, so the rest of the app does not depend on it.
 */

export interface SupabaseIdentity {
    id: string
    email: string | null
}

export function supabaseAuthConfig(): { url: string; key: string } | null {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    if (!url || !key) return null
    return { url: url.replace(/\/+$/, ''), key }
}

export async function identityForAccessToken(
    accessToken: string,
    fetcher: typeof fetch = fetch
): Promise<SupabaseIdentity> {
    const config = supabaseAuthConfig()
    if (!config) throw new ApiError(503, 'ACCOUNTS_OFF', 'accounts are not configured on this deployment')
    const response = await fetcher(`${config.url}/auth/v1/user`, {
        headers: { apikey: config.key, Authorization: `Bearer ${accessToken}` },
        cache: 'no-store',
        signal: AbortSignal.timeout(8000),
    })
    if (response.status === 401 || response.status === 403) {
        throw new ApiError(401, 'SIGN_IN_EXPIRED', 'the sign-in token was refused')
    }
    if (!response.ok) throw new ApiError(502, 'SIGN_IN_UNAVAILABLE', `auth server answered ${response.status}`)
    const body = (await response.json()) as { id?: unknown; email?: unknown }
    if (typeof body.id !== 'string' || body.id.length === 0) {
        throw new ApiError(502, 'SIGN_IN_UNAVAILABLE', 'auth server returned no user id')
    }
    return { id: body.id, email: typeof body.email === 'string' && body.email ? body.email.toLowerCase() : null }
}

/**
 * Sign in with a Supabase access token from Google, or sign out.
 * Tribu checks the token with Supabase once and then relies on its own cookie.
 */
import { accountForSignIn, accountSummary } from '@/server/account/accounts'
import { requireSameOrigin, respondWithCookie } from '@/server/account/routes'
import { clearedSessionCookie, sessionCookie } from '@/server/account/session'
import { identityForAccessToken } from '@/server/account/supabase'
import { readJson } from '@/server/http'
import { WRITE_LIMIT, enforceRateLimit } from '@/server/rateLimit'
import { accountSessionSchema } from '@/server/validation'

export const dynamic = 'force-dynamic'

export const POST = (request: Request) =>
    respondWithCookie(async () => {
        enforceRateLimit(request, WRITE_LIMIT, 'account-session')
        requireSameOrigin(request)
        const { accessToken } = accountSessionSchema.parse(await readJson(request))
        const identity = await identityForAccessToken(accessToken)
        const userId = await accountForSignIn({
            provider: 'supabase',
            providerId: identity.id,
            email: identity.email,
        })
        return { body: { account: await accountSummary(userId) }, cookie: sessionCookie(request, userId) }
    })

export const DELETE = (request: Request) =>
    respondWithCookie(async () => {
        requireSameOrigin(request)
        return { body: { account: null }, cookie: clearedSessionCookie(request) }
    })

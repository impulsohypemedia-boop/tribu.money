/** Who is signed in on this device, if anyone, and whether sign-in is offered at all. */
import { accountSummary } from '@/server/account/accounts'
import { sessionFromRequest } from '@/server/account/session'
import { supabaseAuthConfig } from '@/server/account/supabase'
import { respond } from '@/server/http'

export const dynamic = 'force-dynamic'

export const GET = (request: Request) =>
    respond(async () => {
        const enabled = supabaseAuthConfig() !== null
        const userId = sessionFromRequest(request)
        const account = userId ? await accountSummary(userId) : null
        return { enabled, account }
    })

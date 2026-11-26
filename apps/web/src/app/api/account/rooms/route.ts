/**
 * Keep an account's tribus in step across devices: this device hands over the member tokens it
 * holds, and gets back every tribu the account belongs to, so a new phone can pick them all up.
 */
import { syncMemberships } from '@/server/account/accounts'
import { requireSameOrigin, requireSession } from '@/server/account/routes'
import { readJson, respond } from '@/server/http'
import { WRITE_LIMIT, enforceRateLimit } from '@/server/rateLimit'
import { accountRoomsSchema } from '@/server/validation'

export const dynamic = 'force-dynamic'

export const POST = (request: Request) =>
    respond(async () => {
        enforceRateLimit(request, WRITE_LIMIT, 'account-rooms')
        requireSameOrigin(request)
        const userId = requireSession(request)
        const { held } = accountRoomsSchema.parse(await readJson(request))
        return { memberships: await syncMemberships(userId, held) }
    })

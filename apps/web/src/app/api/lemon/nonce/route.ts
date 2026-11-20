import { respond } from '@/server/http'
import { mintNonce } from '@/server/lemon/identity'
import { WRITE_LIMIT, enforceRateLimit } from '@/server/rateLimit'

export const dynamic = 'force-dynamic'

/** A fresh nonce for Lemon's sign-in message. Stateless; see `server/lemon/identity.ts`. */
export const GET = (request: Request) =>
    respond(async () => {
        enforceRateLimit(request, WRITE_LIMIT, 'lemon-nonce')
        return { nonce: mintNonce() }
    })

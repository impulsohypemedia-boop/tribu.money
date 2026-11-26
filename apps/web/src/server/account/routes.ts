import { ApiError, errorEnvelope, json } from '@/server/http'
import { sameOriginWrite, sessionFromRequest } from './session'

/** Account routes answer like the rest of the API, but may also set or clear the session cookie. */
export async function respondWithCookie(run: () => Promise<{ body: unknown; cookie?: string }>): Promise<Response> {
    try {
        const { body, cookie } = await run()
        return json(body, 200, cookie ? { 'Set-Cookie': cookie } : {})
    } catch (err) {
        return errorEnvelope(err)
    }
}

export function requireSameOrigin(request: Request): void {
    if (!sameOriginWrite(request)) throw new ApiError(403, 'CROSS_SITE', 'cross-site account write refused')
}

export function requireSession(request: Request): string {
    const userId = sessionFromRequest(request)
    if (!userId) throw new ApiError(401, 'SIGNED_OUT', 'no Tribu session on this device')
    return userId
}

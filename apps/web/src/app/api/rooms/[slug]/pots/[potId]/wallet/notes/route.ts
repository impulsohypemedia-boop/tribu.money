/** What a payment from the vaquita's wallet is for, kept off-chain under the proposal's memo. */
import { readJson, respond } from '@/server/http'
import { addPotWalletNote, potWrite } from '@/server/pots'
import { potWalletNoteSchema } from '@/server/validation'

export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ slug: string; potId: string }> }

export const POST = (request: Request, ctx: Ctx) =>
    respond(async () => {
        const { slug, potId } = await ctx.params
        const note = potWalletNoteSchema.parse(await readJson(request))
        return potWrite(request, slug, async (tx, room) => {
            await addPotWalletNote(tx, room, potId, note)
            return false
        })
    }, 201)

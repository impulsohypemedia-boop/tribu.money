import { prisma } from '@/server/db'

export type AccountProvider = 'supabase'

/**
 * Find or create the account behind a verified sign-in.
 *
 * Today the only way in is Google through Supabase, so `providerId` is the Supabase user id. The
 * provider column stays so a second way in can join the same account later.
 */
export async function accountForSignIn(input: {
    provider: AccountProvider
    providerId: string
    email?: string | null
}): Promise<string> {
    const { provider, providerId, email } = input
    return prisma.$transaction(async (tx) => {
        const existing = await tx.authAccount.findUnique({
            where: { provider_providerId: { provider, providerId } },
            select: { userId: true },
        })
        let userId = existing?.userId ?? null
        if (!userId) userId = (await tx.user.create({ data: {}, select: { id: true } })).id
        if (!existing) await tx.authAccount.create({ data: { userId, provider, providerId } })
        await tx.user.update({
            where: { id: userId },
            data: { lastSeenAt: new Date(), ...(email ? { email } : {}) },
        })
        return userId
    })
}

export interface AccountSummary {
    email: string | null
}

export async function accountSummary(userId: string): Promise<AccountSummary | null> {
    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { email: true },
    })
    return user ? { email: user.email } : null
}

export interface AccountMembership {
    slug: string
    roomName: string
    emoji: string | null
    theme: string | null
    kind: string
    memberId: string
    name: string
    token: string
}

const MAX_LINKS = 200

/**
 * Attach the members this device holds tokens for to the account, then list every member the
 * account holds. A member token is the proof: it is what this device already uses to act as that
 * member. A member already held by a different account stays with that account.
 */
export async function syncMemberships(
    userId: string,
    held: ReadonlyArray<{ slug: string; token: string }>
): Promise<AccountMembership[]> {
    const tokens = held.slice(0, MAX_LINKS)
    if (tokens.length > 0) {
        const members = await prisma.member.findMany({
            where: { token: { in: tokens.map((entry) => entry.token) }, removedAt: null },
            select: { id: true, token: true, userId: true, room: { select: { slug: true } } },
        })
        const slugByToken = new Map(tokens.map((entry) => [entry.token, entry.slug]))
        const claimable = members.filter(
            (member) => slugByToken.get(member.token) === member.room.slug && member.userId === null
        )
        if (claimable.length > 0) {
            await prisma.member.updateMany({
                where: { id: { in: claimable.map((member) => member.id) }, userId: null },
                data: { userId },
            })
        }
    }

    const mine = await prisma.member.findMany({
        where: { userId, removedAt: null },
        select: {
            id: true,
            name: true,
            token: true,
            room: { select: { slug: true, name: true, emoji: true, theme: true, kind: true } },
        },
        orderBy: { createdAt: 'desc' },
    })
    return mine.map((member) => ({
        slug: member.room.slug,
        roomName: member.room.name,
        emoji: member.room.emoji,
        theme: member.room.theme,
        kind: member.room.kind,
        memberId: member.id,
        name: member.name,
        token: member.token,
    }))
}

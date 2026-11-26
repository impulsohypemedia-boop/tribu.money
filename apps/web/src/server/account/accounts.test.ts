import { beforeEach, describe, expect, it } from 'vitest'
import { prisma, truncateAll } from '@/server/test/db'
import { accountForSignIn, syncMemberships } from './accounts'

const makeRoom = (slug: string, names: string[]) =>
    prisma.room.create({
        data: {
            slug,
            name: `Tribu ${slug}`,
            currency: 'ARS',
            members: { create: names.map((name) => ({ name, token: `tok-${slug}-${name}` })) },
        },
        include: { members: true },
    })

describe('accounts', () => {
    beforeEach(async () => {
        await truncateAll()
    })

    it('returns the same account for the same Google identity', async () => {
        const first = await accountForSignIn({ provider: 'supabase', providerId: 'g-1', email: 'ana@example.com' })
        const again = await accountForSignIn({ provider: 'supabase', providerId: 'g-1', email: 'ana@example.com' })
        const other = await accountForSignIn({ provider: 'supabase', providerId: 'g-2', email: 'beto@example.com' })
        expect(again).toBe(first)
        expect(other).not.toBe(first)
    })

    it('moves a tribu from one phone to another through the account', async () => {
        const room = await makeRoom('casa-aaaaaa', ['Ana', 'Beto'])
        const ana = room.members.find((member) => member.name === 'Ana')!
        const userId = await accountForSignIn({ provider: 'supabase', providerId: 'g-1', email: null })

        const fromOldPhone = await syncMemberships(userId, [{ slug: room.slug, token: ana.token }])
        expect(fromOldPhone).toHaveLength(1)

        const onNewPhone = await syncMemberships(userId, [])
        expect(onNewPhone).toEqual([
            expect.objectContaining({ slug: room.slug, memberId: ana.id, name: 'Ana', token: ana.token }),
        ])
    })

    it('ignores a token sent with the wrong tribu link', async () => {
        const room = await makeRoom('casa-bbbbbb', ['Ana'])
        await makeRoom('otra-cccccc', ['Zoe'])
        const userId = await accountForSignIn({ provider: 'supabase', providerId: 'g-1', email: null })
        expect(await syncMemberships(userId, [{ slug: 'otra-cccccc', token: room.members[0].token }])).toEqual([])
    })

    it('never takes a member another account already holds', async () => {
        const room = await makeRoom('casa-dddddd', ['Ana'])
        const held = [{ slug: room.slug, token: room.members[0].token }]
        const first = await accountForSignIn({ provider: 'supabase', providerId: 'g-1', email: null })
        const second = await accountForSignIn({ provider: 'supabase', providerId: 'g-2', email: null })
        expect(await syncMemberships(first, held)).toHaveLength(1)
        expect(await syncMemberships(second, held)).toEqual([])
    })
})

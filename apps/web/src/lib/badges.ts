/**
 * Insignias: personal badges, earned from what the rooms this phone is in already hold. Unlike
 * the tribu's logros, a badge belongs to one person, so it is worked out per member and per room.
 * Each has a fixed number, which is also its token id if it is ever kept as an NFT.
 */
import type { RoomState } from './api-types'
import { potSummary } from './pots'

export const BADGES = [
    { id: 'fast-payer', tokenId: 1 },
    { id: 'crypto-payer', tokenId: 2 },
    { id: 'keeper', tokenId: 3 },
    { id: 'rounder', tokenId: 4 },
    { id: 'pot-goal', tokenId: 5 },
] as const
export type BadgeId = (typeof BADGES)[number]['id']

const DAY_MS = 24 * 60 * 60 * 1000
/** Round-ups it takes to be a "redondeador". */
export const ROUNDER_COUNT = 3

/** The badges `memberId` earned in one room. */
export function badgesInRoom(state: RoomState, memberId: string): Set<BadgeId> {
    const earned = new Set<BadgeId>()
    const mine = state.settlements.filter((settlement) => settlement.fromId === memberId)

    // Paid within a day of an expense somebody else covered for them.
    const owedAt = state.expenses
        .filter(
            (expense) =>
                expense.paidById !== memberId &&
                expense.shares.some((share) => share.memberId === memberId && BigInt(share.amountMinor) > 0n)
        )
        .map((expense) => Date.parse(expense.createdAt))
    if (
        mine.some((settlement) => {
            const paid = Date.parse(settlement.createdAt)
            return owedAt.some((at) => paid >= at && paid - at <= DAY_MS)
        })
    )
        earned.add('fast-payer')

    if (mine.some((settlement) => settlement.token)) earned.add('crypto-payer')

    const pots = state.pots ?? []
    if (pots.some((pot) => pot.keeperId === memberId)) earned.add('keeper')
    const roundUps = pots.flatMap((pot) =>
        pot.contributions.filter((c) => c.memberId === memberId && c.reason === 'roundup')
    )
    if (roundUps.length >= ROUNDER_COUNT) earned.add('rounder')
    if (
        pots.some(
            (pot) =>
                pot.contributions.some((c) => c.memberId === memberId) && potSummary(pot, state).missingMinor === '0'
        )
    )
        earned.add('pot-goal')

    return earned
}

/** Every badge this phone's person earned, with the first room each came from. */
export function myBadges(rooms: readonly { slug: string; meId: string | null; state: RoomState }[]) {
    const found = new Map<BadgeId, string>()
    for (const room of rooms) {
        if (!room.meId) continue
        for (const id of badgesInRoom(room.state, room.meId)) if (!found.has(id)) found.set(id, room.slug)
    }
    return found
}

export const badgeTokenId = (id: BadgeId) => BADGES.find((badge) => badge.id === id)!.tokenId
export const isBadgeId = (value: string): value is BadgeId => BADGES.some((badge) => badge.id === value)

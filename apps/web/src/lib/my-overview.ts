/**
 * Inicio: how this device's person stands across every room it remembers.
 *
 * There are no accounts, so "you" is the member identity this device holds in each room. A room
 * this device never joined contributes nothing to the totals. Everything here is pure and reads
 * room snapshots the client already fetched; amounts stay as BigInt and per currency, because two
 * rooms in different currencies cannot be added together.
 */
import type { ApiPot, ApiRecurringExpense, RoomState } from './api-types'
import { potSummary, type PotSummary } from './pots'

export interface MyRoom {
    slug: string
    /** This device's member id in the room, if it joined. */
    meId: string | null
    state: RoomState
}

export interface CurrencyTotal {
    currency: string
    /** Positive: the others owe you this much in total. */
    owedToMeMinor: string
    /** Positive: you owe this much in total. */
    iOweMinor: string
}

export interface RoomPosition {
    slug: string
    name: string
    currency: string
    /** Signed: positive means the room owes you. */
    netMinor: string
}

export interface MyPositions {
    totals: CurrencyTotal[]
    /** Only rooms where you are not square, biggest first within each sign. */
    rooms: RoomPosition[]
}

export function myPositions(rooms: readonly MyRoom[]): MyPositions {
    const owed = new Map<string, bigint>()
    const owe = new Map<string, bigint>()
    const positions: RoomPosition[] = []
    for (const room of rooms) {
        if (!room.meId) continue
        // What sits in a vaquita is the group's money waiting for its goal, not a debt to settle.
        if (room.state.room.kind === 'vaquita') continue
        const raw = room.state.balances[room.meId]
        if (raw === undefined) continue
        const net = BigInt(raw)
        if (net === 0n) continue
        const currency = room.state.room.currency
        if (net > 0n) owed.set(currency, (owed.get(currency) ?? 0n) + net)
        else owe.set(currency, (owe.get(currency) ?? 0n) - net)
        positions.push({ slug: room.slug, name: room.state.room.name, currency, netMinor: net.toString() })
    }
    const currencies = [...new Set([...owed.keys(), ...owe.keys()])].sort()
    return {
        totals: currencies.map((currency) => ({
            currency,
            owedToMeMinor: (owed.get(currency) ?? 0n).toString(),
            iOweMinor: (owe.get(currency) ?? 0n).toString(),
        })),
        rooms: positions.sort((a, b) => {
            const x = BigInt(a.netMinor)
            const y = BigInt(b.netMinor)
            const ax = x < 0n ? -x : x
            const ay = y < 0n ? -y : y
            return ax > ay ? -1 : ax < ay ? 1 : 0
        }),
    }
}

export interface UpcomingFixed {
    slug: string
    roomName: string
    item: ApiRecurringExpense
    /** Day of this month it lands on, already clamped to the month's length. */
    day: number
    /** Already loaded this month (its day has passed). */
    done: boolean
    /** Lands today. */
    today: boolean
}

const daysInMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()

/** Every monthly expense across your rooms, in the order it lands this month. */
export function upcomingFixed(rooms: readonly MyRoom[], now = new Date()): UpcomingFixed[] {
    const last = daysInMonth(now)
    const today = now.getDate()
    const items: UpcomingFixed[] = []
    for (const room of rooms) {
        for (const item of room.state.recurring ?? []) {
            const day = Math.min(item.dayOfMonth, last)
            items.push({
                slug: room.slug,
                roomName: room.state.room.name,
                item,
                day,
                done: day < today,
                today: day === today,
            })
        }
    }
    // What is still coming goes first, soonest at the top; what already went in this month follows.
    return items.sort((a, b) => (a.done !== b.done ? (a.done ? 1 : -1) : a.day - b.day))
}

export interface MyPot {
    slug: string
    roomName: string
    currency: string
    pot: ApiPot
    summary: PotSummary
}

/** Open vaquitas across your rooms, the ones closest to their goal first. */
export function myPots(rooms: readonly MyRoom[], now = new Date()): MyPot[] {
    const pots: MyPot[] = []
    for (const room of rooms) {
        for (const pot of room.state.pots ?? []) {
            if (pot.closedAt) continue
            pots.push({
                slug: room.slug,
                roomName: room.state.room.name,
                currency: room.state.room.currency,
                pot,
                summary: potSummary(pot, room.state, now),
            })
        }
    }
    return pots.sort((a, b) => (b.summary.progressPct ?? -1) - (a.summary.progressPct ?? -1))
}

export interface MyActivity {
    slug: string
    roomName: string
    kind: 'paid' | 'shared' | 'sent' | 'received'
    /** Expense description, or the other person's name for a payment. */
    label: string
    amountMinor: string
    currency: string
    at: string
}

/** Your latest movements across rooms: what you paid, shared, sent and received. Newest first. */
export function myActivity(rooms: readonly MyRoom[], limit = 15): MyActivity[] {
    const items: MyActivity[] = []
    for (const room of rooms) {
        const me = room.meId
        if (!me) continue
        const name = (id: string) => room.state.members.find((member) => member.id === id)?.name ?? '?'
        const base = { slug: room.slug, roomName: room.state.room.name }
        for (const expense of room.state.expenses) {
            const mine = expense.paidById === me
            if (!mine && !expense.shares.some((share) => share.memberId === me)) continue
            items.push({
                ...base,
                kind: mine ? 'paid' : 'shared',
                label: expense.description,
                amountMinor: expense.amountMinor,
                currency: expense.currency,
                at: expense.createdAt,
            })
        }
        for (const settlement of room.state.settlements) {
            if (settlement.fromId !== me && settlement.toId !== me) continue
            const sent = settlement.fromId === me
            items.push({
                ...base,
                kind: sent ? 'sent' : 'received',
                label: name(sent ? settlement.toId : settlement.fromId),
                amountMinor: settlement.amountMinor,
                currency: room.state.room.currency,
                at: settlement.createdAt,
            })
        }
    }
    return items.sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0)).slice(0, limit)
}

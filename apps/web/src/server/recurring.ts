/**
 * Monthly shared expenses: rent, subscriptions, club fees.
 *
 * A template is copied from an expense somebody already saved, so the first month is that
 * expense and every later month is built from the same request through `buildExpense`, the one
 * tested money path. Months are created lazily when the room is read: no scheduler, no
 * background job, and a room nobody opens costs nothing. Each run takes the room write lock and
 * re-reads the template, so two phones opening the room at once create a month only once.
 */
import type { Expense, ExpenseShare, Prisma } from '@prisma/client'
import { prisma } from '@/server/db'
import { buildExpense, expenseNeedsRateTable, latchFirstSharedBalance } from '@/server/expenses'
import { getRateTable } from '@/server/fx'
import { isCatalogCode } from '@/server/money'
import { appendRoomAuditEvent, expenseAuditSnapshot, lockRoomWrite } from '@/server/history'
import { badRequest, notFound } from '@/server/http'
import { loadRoom, type RoomWithRelations } from '@/server/roomState'
import { expenseSchema } from '@/server/validation'
import { defaultSplitMembers } from '@/lib/members'

/** Months are counted in UTC: the room has no time zone, and a day either side is harmless. */
export const monthKey = (date: Date): string =>
    `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`

export const nextMonthKey = (key: string): string => {
    const [year, month] = key.split('-').map(Number)
    return month === 12 ? `${year + 1}-01` : `${year}-${String(month + 1).padStart(2, '0')}`
}

/** The day a template falls on in a given month: day 31 becomes the 30th, or the 28th/29th. */
export function occurrenceDate(key: string, dayOfMonth: number): Date {
    const [year, month] = key.split('-').map(Number)
    const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate()
    return new Date(Date.UTC(year, month - 1, Math.min(dayOfMonth, lastDay), 12))
}

/** Months still owed by a template as of `now`, oldest first, capped so a long-forgotten room
 * cannot create years of rows in one read. */
export function dueMonths(nextMonth: string, dayOfMonth: number, now: Date, cap = 12): string[] {
    const due: string[] = []
    let key = nextMonth
    while (due.length < cap && occurrenceDate(key, dayOfMonth).getTime() <= now.getTime()) {
        due.push(key)
        key = nextMonthKey(key)
    }
    return due
}

type SavedExpense = Expense & { shares: ExpenseShare[] }

/**
 * The request that would create this expense again. An equal split that covered the whole
 * default roster stores no participant list, so somebody who joins later is included next
 * month; any narrower split keeps its exact people.
 */
export function templateBodyOf(room: RoomWithRelations, expense: SavedExpense) {
    const base = {
        description: expense.description,
        amountMinor: expense.amountMinor.toString(),
        currency: expense.currency,
        paidById: expense.paidById,
        category: expense.category,
    }
    if (expense.splitMode === 'EQUAL') {
        const ids = expense.shares.map((share) => share.memberId).sort()
        const roster = defaultSplitMembers(room.members)
            .map((member) => member.id)
            .sort()
        const everyone = ids.length === roster.length && ids.every((id, index) => id === roster[index])
        return { ...base, splitMode: 'EQUAL' as const, ...(everyone ? {} : { participantIds: ids }) }
    }
    if (expense.splitMode === 'EXACT') {
        return {
            ...base,
            splitMode: 'EXACT' as const,
            exactShares: expense.shares.map((share) => ({
                memberId: share.memberId,
                amountMinor: (share.enteredAmountMinor ?? share.amountMinor).toString(),
            })),
        }
    }
    return {
        ...base,
        splitMode: expense.splitMode,
        weightedShares: expense.shares.map((share) => ({
            memberId: share.memberId,
            weight: (share.splitWeight ?? 1n).toString(),
        })),
    }
}

/** Start repeating a saved expense every month from the month after it. */
export async function startRecurring(tx: Prisma.TransactionClient, room: RoomWithRelations, expenseId: string) {
    const expense = await tx.expense.findFirst({
        where: { id: expenseId, roomId: room.id, deletedAt: null },
        include: { shares: true },
    })
    if (!expense) throw notFound('expense not found')
    if (expense.recurringId) {
        const existing = await tx.recurringExpense.findUnique({ where: { id: expense.recurringId } })
        if (existing && !existing.stoppedAt) return existing
    }
    // A custom currency needs a hand-typed rate each time, which a template cannot supply.
    if (expense.currency !== room.currency && !isCatalogCode(expense.currency))
        throw badRequest('this currency cannot repeat on its own', 'RECURRING_CURRENCY_UNSUPPORTED')

    const body = templateBodyOf(room, expense)
    const recurring = await tx.recurringExpense.create({
        data: {
            roomId: room.id,
            description: expense.description,
            body,
            dayOfMonth: expense.date.getUTCDate(),
            nextMonth: nextMonthKey(monthKey(expense.date)),
        },
    })
    await tx.expense.update({ where: { id: expense.id }, data: { recurringId: recurring.id } })
    return recurring
}

/**
 * Create every month a room's templates still owe, under the room lock. Returns true when it
 * wrote anything, so the caller can tell other phones to refetch.
 *
 * A month that can no longer be built (its payer left the room, say) stops the template rather
 * than failing every read of the room after it.
 */
export async function materializeRecurring(slug: string, now = new Date()): Promise<boolean> {
    const pending = await prisma.recurringExpense.findMany({
        where: { room: { slug }, stoppedAt: null, nextMonth: { lte: monthKey(now) } },
        select: { id: true, nextMonth: true, dayOfMonth: true },
    })
    if (!pending.some((template) => dueMonths(template.nextMonth, template.dayOfMonth, now).length > 0)) return false

    const room = await loadRoom(slug)
    // Fetched once, outside the lock, and only tolerated to fail: a month in the room's own
    // currency needs no rate, and one that does fails on its own below.
    const rateTable = await getRateTable(room.currency).catch(() => undefined)

    return prisma.$transaction(async (tx) => {
        await lockRoomWrite(tx, room.id)
        let wrote = false
        const templates = await tx.recurringExpense.findMany({
            where: { roomId: room.id, stoppedAt: null, nextMonth: { lte: monthKey(now) } },
            orderBy: { createdAt: 'asc' },
        })
        for (const template of templates) {
            const months = dueMonths(template.nextMonth, template.dayOfMonth, now)
            if (months.length === 0) continue
            let nextMonth = template.nextMonth
            let stopped = false
            for (const month of months) {
                const lockedRoom = await loadRoom(slug, tx)
                const parsed = expenseSchema.safeParse({
                    ...(template.body as Record<string, unknown>),
                    date: occurrenceDate(month, template.dayOfMonth).toISOString(),
                })
                if (!parsed.success || !parsed.data.paidById) {
                    stopped = true
                    break
                }
                const body = { ...parsed.data, paidById: parsed.data.paidById }
                let write
                try {
                    const table = expenseNeedsRateTable(lockedRoom.currency, body.currency, undefined, undefined)
                        ? rateTable
                        : undefined
                    write = await buildExpense(lockedRoom, body, undefined, table)
                } catch {
                    stopped = true
                    break
                }
                const expense = await tx.expense.create({
                    data: {
                        roomId: lockedRoom.id,
                        description: write.description,
                        amountMinor: write.amountMinor,
                        currency: write.currency,
                        baseAmountMinor: write.baseAmountMinor,
                        fxRate: write.fxRate,
                        paidById: write.paidById,
                        createdById: null,
                        splitMode: write.splitMode,
                        date: write.date,
                        category: write.category,
                        recurringId: template.id,
                        shares: { createMany: { data: write.shares } },
                    },
                })
                await latchFirstSharedBalance(tx, lockedRoom, expense.id, write.paidById, write.shares)
                await appendRoomAuditEvent({
                    tx,
                    // Nobody typed this month: no device and no member are credited with it.
                    request: new Request('https://tribu.money/recurring'),
                    roomId: lockedRoom.id,
                    actor: { memberId: null, memberName: null },
                    event: {
                        kind: 'expense_added',
                        expenseId: expense.id,
                        subjectType: 'expense',
                        subjectId: expense.id,
                        after: expenseAuditSnapshot({ ...expense, shares: write.shares, reactions: [] }),
                        detail: { recurringId: template.id, month },
                    },
                })
                nextMonth = nextMonthKey(month)
                wrote = true
            }
            await tx.recurringExpense.update({
                where: { id: template.id },
                data: { nextMonth, ...(stopped ? { stoppedAt: now } : {}) },
            })
        }
        return wrote
    })
}

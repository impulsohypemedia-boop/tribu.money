/**
 * Reads and writes the tribu's book of account (`LedgerEntry` / `LedgerPosting`).
 *
 * People keep editing expenses, payments and pot contributions as before. After every audited
 * write, `syncRoomLedger` compares each movement with its live record in the book and appends
 * whatever brings them back in line: a reversal, a new record, or both. Because it compares
 * instead of replaying the request, no write path can be missed or counted twice, and running it
 * again changes nothing. The rules live in `src/lib/ledger.ts`.
 *
 * Ideas taken from Apache Fineract's journal entries (reversals instead of edits) and Sequence's
 * balanced transactions (every entry sums to zero); no code was copied from either.
 */
import { Prisma } from '@prisma/client'
import type { ApiLedgerEntry, LedgerPage } from '@/lib/api-types'
import {
    contributionLines,
    expenseLines,
    ledgerWritesFor,
    memberBalancesFromLines,
    settlementLines,
    type LedgerAccountType,
    type LedgerLine,
    type LedgerSourceType,
    type LiveRecord,
} from '@/lib/ledger'
import { prisma } from '@/server/db'
import { badRequest, notFound } from '@/server/http'

type Db = Prisma.TransactionClient

interface Wanted {
    sourceType: LedgerSourceType
    sourceId: string
    lines: LedgerLine[]
    description: string | null
    detail: Prisma.InputJsonValue
    occurredAt: Date
}

const sourceKey = (sourceType: string, sourceId: string) => `${sourceType}:${sourceId}`

const toLine = (posting: { accountType: string; accountId: string; amountMinor: bigint }): LedgerLine => ({
    accountType: posting.accountType as LedgerAccountType,
    accountId: posting.accountId,
    amountMinor: posting.amountMinor,
})

/** Every movement that counts right now, with the postings it should have. */
async function wantedMovements(db: Db, roomId: string): Promise<Wanted[]> {
    const [expenses, settlements, pots] = await Promise.all([
        db.expense.findMany({
            where: { roomId, deletedAt: null },
            select: {
                id: true,
                description: true,
                amountMinor: true,
                currency: true,
                baseAmountMinor: true,
                paidById: true,
                potId: true,
                category: true,
                date: true,
                shares: { select: { memberId: true, amountMinor: true } },
            },
        }),
        db.settlement.findMany({ where: { roomId, deletedAt: null } }),
        db.pot.findMany({
            where: { roomId },
            select: {
                id: true,
                name: true,
                keeperId: true,
                contributions: { where: { deletedAt: null } },
            },
        }),
    ])
    const keeperByPot = new Map(pots.map((pot) => [pot.id, pot.keeperId]))
    return [
        ...expenses.map((expense): Wanted => ({
            sourceType: 'expense',
            sourceId: expense.id,
            lines: expenseLines(expense, keeperByPot),
            description: expense.description,
            detail: {
                amountMinor: expense.amountMinor.toString(),
                currency: expense.currency,
                paidById: expense.paidById,
                category: expense.category,
                potId: expense.potId,
            },
            occurredAt: expense.date,
        })),
        ...settlements.map((settlement): Wanted => ({
            sourceType: 'settlement',
            sourceId: settlement.id,
            lines: settlementLines(settlement),
            description: settlement.note,
            detail: { fromId: settlement.fromId, toId: settlement.toId, method: settlement.method },
            occurredAt: settlement.createdAt,
        })),
        ...pots.flatMap((pot) =>
            pot.contributions.map((contribution): Wanted => ({
                sourceType: 'pot_contribution',
                sourceId: contribution.id,
                lines: contributionLines(contribution, pot.keeperId),
                description: pot.name,
                detail: {
                    potId: pot.id,
                    memberId: contribution.memberId,
                    keeperId: pot.keeperId,
                    reason: contribution.reason,
                },
                occurredAt: contribution.createdAt,
            }))
        ),
    ].sort((a, b) => a.occurredAt.getTime() - b.occurredAt.getTime() || a.sourceId.localeCompare(b.sourceId))
}

/**
 * Bring the room's book in line with its expenses, payments and pot contributions. Call it inside
 * the write's transaction, under the room lock, after the rows have changed. Returns how many
 * entries it appended.
 */
export async function syncRoomLedger(db: Db, roomId: string): Promise<number> {
    const room = await db.room.findUnique({ where: { id: roomId }, select: { currency: true } })
    if (!room) return 0
    const [wanted, liveRows] = await Promise.all([
        wantedMovements(db, roomId),
        db.ledgerEntry.findMany({
            where: { roomId, kind: 'record', reversedBy: null },
            include: { postings: true },
            orderBy: { id: 'asc' },
        }),
    ])

    const live = new Map(liveRows.map((row) => [sourceKey(row.sourceType, row.sourceId), row]))
    const wantedByKey = new Map(wanted.map((movement) => [sourceKey(movement.sourceType, movement.sourceId), movement]))
    let appended = 0

    const append = async (
        sourceType: string,
        sourceId: string,
        liveRow: (typeof liveRows)[number] | undefined,
        movement: Wanted | undefined
    ) => {
        const liveRecord: LiveRecord | null = liveRow ? { id: liveRow.id, lines: liveRow.postings.map(toLine) } : null
        for (const write of ledgerWritesFor(liveRecord, movement?.lines ?? null)) {
            const snapshot =
                write.kind === 'record' && movement
                    ? { description: movement.description, detail: movement.detail, occurredAt: movement.occurredAt }
                    : {
                          description: liveRow?.description ?? null,
                          detail: (liveRow?.detail ?? Prisma.DbNull) as Prisma.InputJsonValue | typeof Prisma.DbNull,
                          occurredAt: new Date(),
                      }
            await db.ledgerEntry.create({
                data: {
                    roomId,
                    sourceType,
                    sourceId,
                    kind: write.kind,
                    reversesId: write.kind === 'reversal' ? write.reversesId : null,
                    currency: room.currency,
                    ...snapshot,
                    postings: {
                        create: write.lines.map((line) => ({
                            roomId,
                            accountType: line.accountType,
                            accountId: line.accountId,
                            amountMinor: line.amountMinor,
                        })),
                    },
                },
            })
            appended += 1
        }
    }

    // Removed movements first, then current ones in the order they happened.
    for (const [key, row] of live) {
        if (!wantedByKey.has(key)) await append(row.sourceType, row.sourceId, row, undefined)
    }
    for (const [key, movement] of wantedByKey) {
        await append(movement.sourceType, movement.sourceId, live.get(key), movement)
    }
    return appended
}

/** Member balances as the book has them. */
export async function ledgerMemberBalances(
    db: Pick<Db, 'ledgerPosting'>,
    roomId: string,
    memberIds: readonly string[]
): Promise<Map<string, bigint>> {
    const sums = await db.ledgerPosting.groupBy({
        by: ['accountId'],
        where: { roomId, accountType: 'member' },
        _sum: { amountMinor: true },
    })
    return memberBalancesFromLines(
        memberIds,
        sums.map((row) => ({
            accountType: 'member' as const,
            accountId: row.accountId,
            amountMinor: row._sum.amountMinor ?? 0n,
        }))
    )
}

const PAGE_SIZE = 50
const INT64_MAX = 9223372036854775807n

const detailOf = (value: Prisma.JsonValue | null): Record<string, string | null> => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, typeof item === 'string' ? item : null]))
}

/** The room's movements, newest first, 50 at a time. */
export async function roomLedgerBySlug(slug: string, cursor?: string | null): Promise<LedgerPage> {
    const room = await prisma.room.findUnique({ where: { slug }, select: { id: true } })
    if (!room) throw notFound('room not found')

    const cursorId = cursor && /^\d+$/.test(cursor) ? BigInt(cursor) : null
    if (cursor && (cursorId === null || cursorId > INT64_MAX))
        throw badRequest('ledger cursor is invalid', 'HISTORY_CURSOR_INVALID')

    const rows = await prisma.ledgerEntry.findMany({
        where: { roomId: room.id, ...(cursorId ? { id: { lt: cursorId } } : {}) },
        include: { postings: { orderBy: { id: 'asc' } } },
        orderBy: { id: 'desc' },
        take: PAGE_SIZE + 1,
    })
    const more = rows.length > PAGE_SIZE
    const page = rows.slice(0, PAGE_SIZE)
    return {
        entries: page.map((row): ApiLedgerEntry => ({
            id: row.id.toString(),
            sourceType: row.sourceType as LedgerSourceType,
            sourceId: row.sourceId,
            kind: row.kind === 'reversal' ? 'reversal' : 'record',
            reversesId: row.reversesId?.toString() ?? null,
            currency: row.currency,
            description: row.description,
            detail: detailOf(row.detail),
            occurredAt: row.occurredAt.toISOString(),
            createdAt: row.createdAt.toISOString(),
            postings: row.postings.map((posting) => ({
                accountType: posting.accountType as LedgerAccountType,
                accountId: posting.accountId,
                amountMinor: posting.amountMinor.toString(),
            })),
        })),
        nextCursor: more ? (page.at(-1)?.id.toString() ?? null) : null,
    }
}

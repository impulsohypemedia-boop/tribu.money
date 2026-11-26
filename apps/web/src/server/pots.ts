/**
 * La vaquita: a shared pot with a goal, kept in one member's own account.
 *
 * Tribu never holds the money, so the pot adds no new kind of balance. A contribution from
 * anyone other than the keeper is a payment to the keeper (a settlement row, so it shows in the
 * feed and in every balance), and the keeper's own contribution moves nothing. An expense the
 * pot pays is an expense paid by the keeper. What is left in the pot is therefore already the
 * credit its contributors hold with the keeper, and closing the pot needs no money step.
 */
import type { Prisma } from '@prisma/client'
import { isActiveMember } from '@/lib/members'
import { prisma } from '@/server/db'
import { publish } from '@/server/events'
import { actorFromToken, appendRoomAuditEvent, lockRoomWrite, type AuditActor } from '@/server/history'
import { badRequest, memberTokenOf, notFound } from '@/server/http'
import { syncRoomLedger } from '@/server/ledger'
import { WRITE_LIMIT, enforceRateLimit } from '@/server/rateLimit'
import { loadRoom, toRoomState, type RoomWithRelations } from '@/server/roomState'

type Tx = Prisma.TransactionClient

const positiveOrNull = (value: string | null | undefined): bigint | null => {
    if (value === undefined || value === null) return null
    const amount = BigInt(value)
    return amount > 0n ? amount : null
}

function activeMember(room: RoomWithRelations, memberId: string) {
    const member = room.members.find((candidate) => candidate.id === memberId)
    if (!member || !isActiveMember(member)) throw badRequest('not a member of this room', 'NOT_A_MEMBER')
    return member
}

export async function openPot(tx: Tx, room: RoomWithRelations, potId: string) {
    const pot = await tx.pot.findFirst({ where: { id: potId, roomId: room.id } })
    if (!pot) throw notFound('pot not found', 'POT_NOT_FOUND')
    if (pot.closedAt) throw badRequest('this pot is closed', 'POT_CLOSED')
    return pot
}

export async function createPot(
    tx: Tx,
    request: Request,
    room: RoomWithRelations,
    actor: AuditActor,
    body: {
        name: string
        keeperId: string
        targetMinor?: string | null
        quotaMinor?: string | null
        dueDate?: string | null
        yieldAprBps?: number | null
    }
) {
    activeMember(room, body.keeperId)
    const pot = await tx.pot.create({
        data: {
            roomId: room.id,
            name: body.name,
            keeperId: body.keeperId,
            targetMinor: positiveOrNull(body.targetMinor),
            quotaMinor: positiveOrNull(body.quotaMinor),
            dueDate: body.dueDate ? new Date(body.dueDate) : null,
            yieldAprBps: body.yieldAprBps ?? null,
        },
    })
    await appendRoomAuditEvent({
        tx,
        request,
        roomId: room.id,
        actor,
        event: {
            kind: 'pot_updated',
            subjectType: 'room',
            subjectId: pot.id,
            after: pot,
            detail: { change: 'created' },
        },
    })
    return pot
}

export async function updatePot(
    tx: Tx,
    request: Request,
    room: RoomWithRelations,
    actor: AuditActor,
    potId: string,
    body: {
        name?: string
        targetMinor?: string | null
        quotaMinor?: string | null
        dueDate?: string | null
        yieldAprBps?: number | null
        closed?: boolean
    }
) {
    const before = await tx.pot.findFirst({ where: { id: potId, roomId: room.id } })
    if (!before) throw notFound('pot not found', 'POT_NOT_FOUND')
    const after = await tx.pot.update({
        where: { id: potId },
        data: {
            ...(body.name !== undefined ? { name: body.name } : {}),
            ...(body.targetMinor !== undefined ? { targetMinor: positiveOrNull(body.targetMinor) } : {}),
            ...(body.quotaMinor !== undefined ? { quotaMinor: positiveOrNull(body.quotaMinor) } : {}),
            ...(body.dueDate !== undefined ? { dueDate: body.dueDate ? new Date(body.dueDate) : null } : {}),
            ...(body.yieldAprBps !== undefined ? { yieldAprBps: body.yieldAprBps } : {}),
            ...(body.closed !== undefined ? { closedAt: body.closed ? (before.closedAt ?? new Date()) : null } : {}),
        },
    })
    await appendRoomAuditEvent({
        tx,
        request,
        roomId: room.id,
        actor,
        event: { kind: 'pot_updated', subjectType: 'room', subjectId: potId, before, after },
    })
    return after
}

/** Record money put into the pot. Anyone but the keeper is recorded as paying the keeper. */
export async function addContribution(
    tx: Tx,
    request: Request,
    room: RoomWithRelations,
    actor: AuditActor,
    potId: string,
    body: { memberId: string; amountMinor: string; reason?: 'roundup' | null }
) {
    const pot = await openPot(tx, room, potId)
    activeMember(room, body.memberId)
    const amountMinor = BigInt(body.amountMinor)
    if (amountMinor <= 0n) throw badRequest('amount must be greater than zero', 'AMOUNT_NOT_POSITIVE')

    let settlementId: string | null = null
    if (body.memberId !== pot.keeperId) {
        const settlement = await tx.settlement.create({
            data: {
                roomId: room.id,
                fromId: body.memberId,
                toId: pot.keeperId,
                amountMinor,
                method: 'pot',
                note: pot.name,
                createdById: actor.memberId,
            },
        })
        settlementId = settlement.id
        await appendRoomAuditEvent({
            tx,
            request,
            roomId: room.id,
            actor,
            event: {
                kind: 'settlement_recorded',
                settlementId: settlement.id,
                subjectType: 'settlement',
                subjectId: settlement.id,
                after: settlement,
                detail: { potId },
            },
        })
    }
    const contribution = await tx.potContribution.create({
        data: {
            potId,
            memberId: body.memberId,
            amountMinor,
            settlementId,
            reason: body.reason ?? null,
            createdById: actor.memberId,
        },
    })
    // The payment's audit event ran before this row existed; bring the pot's side into the book too.
    if (settlementId) await syncRoomLedger(tx, room.id)
    if (!settlementId) {
        await appendRoomAuditEvent({
            tx,
            request,
            roomId: room.id,
            actor,
            event: {
                kind: 'pot_updated',
                subjectType: 'room',
                subjectId: potId,
                after: contribution,
                detail: { change: 'keeper_contribution' },
            },
        })
    }
    return contribution
}

/** Undo a contribution, and the payment to the keeper that came with it. */
export async function removeContribution(
    tx: Tx,
    request: Request,
    room: RoomWithRelations,
    actor: AuditActor,
    potId: string,
    contributionId: string
) {
    const contribution = await tx.potContribution.findFirst({
        where: { id: contributionId, potId, pot: { roomId: room.id } },
    })
    if (!contribution) throw notFound('contribution not found', 'POT_NOT_FOUND')
    if (contribution.deletedAt) return false
    const deletedAt = new Date()
    await tx.potContribution.update({ where: { id: contributionId }, data: { deletedAt } })
    if (contribution.settlementId) {
        const settlement = await tx.settlement.findUnique({ where: { id: contribution.settlementId } })
        if (settlement && !settlement.deletedAt) {
            await tx.settlement.update({ where: { id: settlement.id }, data: { deletedAt } })
            await appendRoomAuditEvent({
                tx,
                request,
                roomId: room.id,
                actor,
                event: {
                    kind: 'settlement_deleted',
                    subjectType: 'settlement',
                    subjectId: settlement.id,
                    before: settlement,
                    after: { ...settlement, deletedAt },
                },
            })
        }
    } else {
        await appendRoomAuditEvent({
            tx,
            request,
            roomId: room.id,
            actor,
            event: {
                kind: 'pot_updated',
                subjectType: 'room',
                subjectId: potId,
                before: contribution,
                after: { ...contribution, deletedAt },
                detail: { change: 'contribution_removed' },
            },
        })
    }
    return true
}

/**
 * Mark a saved expense as paid by the pot. Its payer must be the keeper, because the pot's
 * money is in the keeper's account; `potId: null` takes the mark off again.
 */
export async function setExpensePot(
    tx: Tx,
    request: Request,
    room: RoomWithRelations,
    actor: AuditActor,
    potId: string | null,
    expenseId: string
) {
    const expense = await tx.expense.findFirst({ where: { id: expenseId, roomId: room.id, deletedAt: null } })
    if (!expense) throw notFound('expense not found', 'EXPENSE_NOT_FOUND')
    if (potId) {
        const pot = await openPot(tx, room, potId)
        if (expense.paidById !== pot.keeperId)
            throw badRequest('the pot is paid from its keeper’s account', 'POT_PAYER_NOT_KEEPER')
    }
    if (expense.potId === potId) return false
    await tx.expense.update({ where: { id: expenseId }, data: { potId } })
    await appendRoomAuditEvent({
        tx,
        request,
        roomId: room.id,
        actor,
        event: {
            kind: 'pot_updated',
            subjectType: 'expense',
            subjectId: expenseId,
            detail: { change: potId ? 'expense_linked' : 'expense_unlinked', potId: potId ?? expense.potId },
        },
    })
    return true
}

/**
 * The one shape every pot route takes: rate limit, room lock, the change, then the fresh room.
 * `change` returns false when nothing was written, so other phones are not told to refetch.
 */
export async function potWrite(
    request: Request,
    slug: string,
    change: (tx: Tx, room: RoomWithRelations, actor: AuditActor) => Promise<unknown>
) {
    enforceRateLimit(request, WRITE_LIMIT, 'write')
    const initial = await loadRoom(slug)
    const result = await prisma.$transaction(async (tx) => {
        await lockRoomWrite(tx, initial.id)
        const room = await loadRoom(slug, tx)
        const changed = (await change(tx, room, actorFromToken(room.members, memberTokenOf(request)))) !== false
        return { changed, state: toRoomState(await loadRoom(slug, tx)) }
    })
    if (result.changed) publish(initial.id)
    return result.state
}

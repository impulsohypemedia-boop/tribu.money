/**
 * La ruleta de la cuenta, apuestas entre amigos y multas.
 *
 * None of them adds a new kind of money. A spin and a settled bet each become an ordinary expense
 * (so they land in the balances and the feed like any other), and a paid fine is a contribution to
 * the tribu's pot (see `pots.ts`). What is new here is only who may do what, and when.
 */
import { createHash, randomBytes } from 'node:crypto'
import type { Prisma } from '@prisma/client'
import { betActions, betLoser, type BetAction, type BetStatus } from '@/lib/bets'
import { fineOutcome, fineVoterIds, type FineVotes } from '@/lib/fines'
import { isActiveMember } from '@/lib/members'
import { drawWinner } from '@/lib/roulette'
import { buildExpense, latchFirstSharedBalance } from '@/server/expenses'
import { appendRoomAuditEvent, expenseAuditSnapshot, type AuditActor } from '@/server/history'
import { badRequest, conflict, notFound } from '@/server/http'
import { addContribution, openPot } from '@/server/pots'
import type { RoomWithRelations } from '@/server/roomState'

type Tx = Prisma.TransactionClient

/** A draw has to be spun within this long of being started, so a stale one cannot be replayed. */
const DRAW_TTL_MS = 60 * 60 * 1000

function requireActor(actor: AuditActor): string {
    if (!actor.memberId) throw badRequest('pick who you are in this tribu first', 'MEMBER_TOKEN_REQUIRED')
    return actor.memberId
}

function requireActive(room: RoomWithRelations, memberId: string) {
    const member = room.members.find((candidate) => candidate.id === memberId)
    if (!member || !isActiveMember(member)) throw badRequest('not a member of this room', 'NOT_A_MEMBER')
    return member
}

function positive(value: string): bigint {
    const amount = BigInt(value)
    if (amount <= 0n) throw badRequest('amount must be greater than zero', 'AMOUNT_NOT_POSITIVE')
    return amount
}

/**
 * An expense in the room's currency, split by exact amounts, written the way the expenses route
 * writes one: the same share maths, the first-shared-balance latch and an audit row.
 */
async function createRoomExpense(
    tx: Tx,
    request: Request,
    room: RoomWithRelations,
    actor: AuditActor,
    input: {
        id: string
        description: string
        amountMinor: bigint
        paidById: string
        shares: { memberId: string; amountMinor: bigint }[]
        category: string
    }
) {
    const write = await buildExpense(room, {
        description: input.description,
        amountMinor: input.amountMinor.toString(),
        currency: room.currency,
        paidById: input.paidById,
        splitMode: 'EXACT',
        exactShares: input.shares.map((share) => ({
            memberId: share.memberId,
            amountMinor: share.amountMinor.toString(),
        })),
        category: input.category,
    })
    const expense = await tx.expense.create({
        data: {
            id: input.id,
            roomId: room.id,
            description: write.description,
            amountMinor: write.amountMinor,
            currency: write.currency,
            baseAmountMinor: write.baseAmountMinor,
            fxRate: write.fxRate,
            paidById: write.paidById,
            createdById: actor.memberId,
            splitMode: write.splitMode,
            date: write.date,
            category: write.category,
            shares: { createMany: { data: write.shares } },
        },
    })
    await latchFirstSharedBalance(tx, room, expense.id, write.paidById, write.shares)
    await appendRoomAuditEvent({
        tx,
        request,
        roomId: room.id,
        actor,
        event: {
            kind: 'expense_added',
            expenseId: expense.id,
            subjectType: 'expense',
            subjectId: expense.id,
            after: expenseAuditSnapshot({ ...expense, shares: write.shares, reactions: [] }),
        },
    })
    return expense
}

// ── La ruleta ────────────────────────────────────────────────────────────────

export async function startDraw(tx: Tx, room: RoomWithRelations) {
    const seed = randomBytes(32).toString('hex')
    const seedHash = createHash('sha256').update(seed).digest('hex')
    const draw = await tx.draw.create({ data: { roomId: room.id, seed, seedHash } })
    return { id: draw.id, seedHash }
}

export async function spinDraw(
    tx: Tx,
    request: Request,
    room: RoomWithRelations,
    actor: AuditActor,
    drawId: string,
    body: { clientSeed: string; participantIds: string[]; paidById: string; amountMinor: string; description: string }
) {
    const draw = await tx.draw.findFirst({ where: { id: drawId, roomId: room.id } })
    if (!draw) throw notFound('draw not found', 'DRAW_NOT_FOUND')
    if (draw.spunAt) throw conflict('this draw was already spun', 'DRAW_ALREADY_SPUN')
    if (Date.now() - draw.createdAt.getTime() > DRAW_TTL_MS) throw badRequest('this draw expired', 'DRAW_EXPIRED')
    const participantIds = [...new Set(body.participantIds)]
    if (participantIds.length < 2) throw badRequest('a draw needs at least two people', 'DRAW_TOO_FEW')
    participantIds.forEach((id) => requireActive(room, id))
    requireActive(room, body.paidById)
    const amountMinor = positive(body.amountMinor)

    const { winnerId } = await drawWinner(draw.seed, body.clientSeed, participantIds)
    // The expense takes the draw's id, so the feed can show the proof next to it.
    await createRoomExpense(tx, request, room, actor, {
        id: draw.id,
        description: body.description,
        amountMinor,
        paidById: body.paidById,
        shares: [{ memberId: winnerId, amountMinor }],
        category: 'food-drink',
    })
    const spun = await tx.draw.update({
        where: { id: draw.id },
        data: {
            clientSeed: body.clientSeed,
            participantIds,
            paidById: body.paidById,
            amountMinor,
            winnerId,
            spunAt: new Date(),
        },
    })
    await appendRoomAuditEvent({
        tx,
        request,
        roomId: room.id,
        actor,
        event: {
            kind: 'draw_spun',
            subjectType: 'expense',
            subjectId: draw.id,
            after: { ...spun, amountMinor: amountMinor.toString() },
        },
    })
    return spun
}

// ── Apuestas ─────────────────────────────────────────────────────────────────

export async function createBet(
    tx: Tx,
    request: Request,
    room: RoomWithRelations,
    actor: AuditActor,
    body: { title: string; amountMinor: string; rivalId: string }
) {
    const proposerId = requireActor(actor)
    requireActive(room, body.rivalId)
    if (body.rivalId === proposerId) throw badRequest('a bet needs someone else', 'BET_SAME_PERSON')
    const bet = await tx.bet.create({
        data: {
            roomId: room.id,
            title: body.title,
            amountMinor: positive(body.amountMinor),
            proposerId,
            rivalId: body.rivalId,
        },
    })
    await appendRoomAuditEvent({
        tx,
        request,
        roomId: room.id,
        actor,
        event: {
            kind: 'bet_updated',
            subjectType: 'room',
            subjectId: bet.id,
            after: bet,
            detail: { change: 'created' },
        },
    })
    return bet
}

export async function actOnBet(
    tx: Tx,
    request: Request,
    room: RoomWithRelations,
    actor: AuditActor,
    betId: string,
    body: { action: BetAction; winnerId?: string }
) {
    const actorId = requireActor(actor)
    const bet = await tx.bet.findFirst({ where: { id: betId, roomId: room.id } })
    if (!bet) throw notFound('bet not found', 'BET_NOT_FOUND')
    const allowed = betActions({ ...bet, status: bet.status as BetStatus }, actorId)
    if (!allowed.includes(body.action)) throw conflict('that is not possible on this bet now', 'BET_ACTION_NOT_ALLOWED')

    let data: Prisma.BetUpdateInput
    switch (body.action) {
        case 'accept':
            data = { status: 'accepted', acceptedAt: new Date() }
            break
        case 'claim':
            if (body.winnerId !== bet.proposerId && body.winnerId !== bet.rivalId)
                throw badRequest('the winner is one of the two', 'BET_WINNER_INVALID')
            data = { status: 'claimed', claimedWinnerId: body.winnerId, claimedById: actorId }
            break
        case 'dispute':
            data = { status: 'accepted', claimedWinnerId: null, claimedById: null }
            break
        case 'cancel':
            data = { status: 'cancelled', resolvedAt: new Date() }
            break
        case 'confirm': {
            const winnerId = bet.claimedWinnerId!
            const loserId = betLoser(bet, winnerId)
            requireActive(room, winnerId)
            requireActive(room, loserId)
            // The loser's stake is an expense the winner paid on the loser's behalf.
            const expense = await createRoomExpense(tx, request, room, actor, {
                id: bet.id,
                description: bet.title,
                amountMinor: bet.amountMinor,
                paidById: winnerId,
                shares: [{ memberId: loserId, amountMinor: bet.amountMinor }],
                category: 'entertainment-leisure',
            })
            data = { status: 'resolved', winnerId, expenseId: expense.id, resolvedAt: new Date() }
            break
        }
    }
    const after = await tx.bet.update({ where: { id: bet.id }, data })
    await appendRoomAuditEvent({
        tx,
        request,
        roomId: room.id,
        actor,
        event: {
            kind: 'bet_updated',
            subjectType: 'room',
            subjectId: bet.id,
            before: bet,
            after,
            detail: { change: body.action },
        },
    })
    return after
}

// ── Multas ───────────────────────────────────────────────────────────────────

const votesOf = (value: Prisma.JsonValue): FineVotes =>
    value && typeof value === 'object' && !Array.isArray(value)
        ? Object.fromEntries(
              Object.entries(value).filter((entry): entry is [string, boolean] => typeof entry[1] === 'boolean')
          )
        : {}

const decidedStatus = (outcome: ReturnType<typeof fineOutcome>) =>
    outcome === 'voting' ? { status: 'voting' } : { status: outcome, decidedAt: new Date() }

export async function proposeFine(
    tx: Tx,
    request: Request,
    room: RoomWithRelations,
    actor: AuditActor,
    body: { memberId: string; reason: string; amountMinor: string }
) {
    const proposerId = requireActor(actor)
    requireActive(room, body.memberId)
    // A fine is paid into the tribu's pot, so the tribu needs one first.
    if (!room.pots.some((pot) => !pot.closedAt)) throw badRequest('this tribu has no pot yet', 'POT_NOT_FOUND')
    const votes: FineVotes = proposerId === body.memberId ? {} : { [proposerId]: true }
    const outcome = fineOutcome(votes, fineVoterIds(room.members, body.memberId))
    const fine = await tx.fine.create({
        data: {
            roomId: room.id,
            memberId: body.memberId,
            reason: body.reason,
            amountMinor: positive(body.amountMinor),
            proposedById: proposerId,
            votes,
            ...decidedStatus(outcome),
        },
    })
    await appendRoomAuditEvent({
        tx,
        request,
        roomId: room.id,
        actor,
        event: {
            kind: 'fine_updated',
            subjectType: 'room',
            subjectId: fine.id,
            after: fine,
            detail: { change: 'proposed' },
        },
    })
    return fine
}

export async function actOnFine(
    tx: Tx,
    request: Request,
    room: RoomWithRelations,
    actor: AuditActor,
    fineId: string,
    body: { action: 'vote' | 'pay' | 'cancel'; vote?: boolean; potId?: string }
) {
    const actorId = requireActor(actor)
    const fine = await tx.fine.findFirst({ where: { id: fineId, roomId: room.id } })
    if (!fine) throw notFound('fine not found', 'FINE_NOT_FOUND')

    let data: Prisma.FineUpdateInput
    if (body.action === 'vote') {
        if (fine.status !== 'voting') throw conflict('the vote is over', 'FINE_VOTE_CLOSED')
        const voters = fineVoterIds(room.members, fine.memberId)
        if (!voters.includes(actorId)) throw badRequest('you do not vote on this fine', 'FINE_NOT_A_VOTER')
        if (typeof body.vote !== 'boolean') throw badRequest('vote yes or no', 'VALIDATION_ERROR')
        const votes = { ...votesOf(fine.votes), [actorId]: body.vote }
        data = { votes, ...decidedStatus(fineOutcome(votes, voters)) }
    } else if (body.action === 'cancel') {
        if (fine.status !== 'voting' && fine.status !== 'approved')
            throw conflict('this fine is already closed', 'FINE_CLOSED')
        if (actorId !== fine.proposedById) throw badRequest('only who proposed it can drop it', 'FINE_NOT_PROPOSER')
        data = { status: 'cancelled', decidedAt: new Date() }
    } else {
        if (fine.status !== 'approved') throw conflict('only an approved fine is paid', 'FINE_NOT_APPROVED')
        const potId = body.potId ?? room.pots.find((pot) => !pot.closedAt)?.id
        if (!potId) throw badRequest('this tribu has no pot yet', 'POT_NOT_FOUND')
        const pot = await openPot(tx, room, potId)
        if (actorId !== fine.memberId && actorId !== pot.keeperId)
            throw badRequest('the fined person or the pot keeper records it', 'FINE_NOT_PAYER')
        const contribution = await addContribution(tx, request, room, actor, potId, {
            memberId: fine.memberId,
            amountMinor: fine.amountMinor.toString(),
            reason: 'fine',
        })
        data = { status: 'paid', contributionId: contribution.id }
    }
    const after = await tx.fine.update({ where: { id: fine.id }, data })
    await appendRoomAuditEvent({
        tx,
        request,
        roomId: room.id,
        actor,
        event: {
            kind: 'fine_updated',
            subjectType: 'room',
            subjectId: fine.id,
            before: fine,
            after,
            detail: { change: body.action },
        },
    })
    return after
}

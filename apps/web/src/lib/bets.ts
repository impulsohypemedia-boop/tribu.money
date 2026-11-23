/**
 * Apuestas entre amigos: what each of the two people in a bet can do at each step.
 *
 * proposed → (rival accepts) accepted → (either says who won) claimed → (the other agrees) resolved.
 * The other one can also say "no fue así" on a claim, which sends it back to accepted. Either can
 * cancel until it is resolved. Nobody else in the tribu acts on a bet.
 */
export type BetStatus = 'proposed' | 'accepted' | 'claimed' | 'resolved' | 'cancelled'
export type BetAction = 'accept' | 'claim' | 'confirm' | 'dispute' | 'cancel'

export interface BetFacts {
    status: BetStatus
    proposerId: string
    rivalId: string
    claimedById: string | null
}

export function betActions(bet: BetFacts, actorId: string | null): BetAction[] {
    if (!actorId) return []
    const inBet = actorId === bet.proposerId || actorId === bet.rivalId
    if (!inBet) return []
    switch (bet.status) {
        case 'proposed':
            return actorId === bet.rivalId ? ['accept', 'cancel'] : ['cancel']
        case 'accepted':
            return ['claim', 'cancel']
        case 'claimed':
            return actorId === bet.claimedById ? ['cancel'] : ['confirm', 'dispute', 'cancel']
        default:
            return []
    }
}

/** The loser of a two-person bet. */
export const betLoser = (bet: Pick<BetFacts, 'proposerId' | 'rivalId'>, winnerId: string) =>
    winnerId === bet.proposerId ? bet.rivalId : bet.proposerId

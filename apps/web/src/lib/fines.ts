/**
 * Multas: the tribu votes on a fine. Everyone active except the fined person votes; more than
 * half saying yes approves it, and as soon as a majority can no longer be reached it is rejected.
 */
export type FineVotes = Record<string, boolean>

export function fineOutcome(votes: FineVotes, voterIds: readonly string[]): 'voting' | 'approved' | 'rejected' {
    const voters = new Set(voterIds)
    let yes = 0
    let no = 0
    for (const [memberId, vote] of Object.entries(votes)) {
        if (!voters.has(memberId)) continue
        if (vote) yes++
        else no++
    }
    const needed = Math.floor(voters.size / 2) + 1
    if (voters.size === 0) return 'approved'
    if (yes >= needed) return 'approved'
    if (voters.size - no < needed) return 'rejected'
    return 'voting'
}

/** Who votes on a fine for `finedId`: active members other than the fined one. */
export const fineVoterIds = (members: readonly { id: string; removedAt?: string | Date | null }[], finedId: string) =>
    members.filter((member) => member.removedAt == null && member.id !== finedId).map((member) => member.id)

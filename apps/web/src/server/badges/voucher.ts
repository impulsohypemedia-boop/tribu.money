/**
 * The voucher that lets a wallet mint one badge it earned. The contract (contracts/TribuBadges.sol)
 * mints only with a signature from TRIBU_BADGE_SIGNER_KEY over (wallet, badge), so the server's
 * check of the badge in the room is the only way in.
 */
import { privateKeyToAccount } from 'viem/accounts'
import { badgesInRoom, badgeTokenId, type BadgeId } from '@/lib/badges'
import { isAddress, lemonNetwork } from '@/lib/lemon/chain'
import { ApiError, badRequest } from '@/server/http'
import { toRoomState, type RoomWithRelations } from '@/server/roomState'

export const badgeContractAddress = () => {
    const value = process.env.NEXT_PUBLIC_TRIBU_BADGES_ADDRESS
    return isAddress(value) ? value : null
}

function signerKey(): `0x${string}` | null {
    const value = process.env.TRIBU_BADGE_SIGNER_KEY
    return value && /^0x[0-9a-fA-F]{64}$/.test(value) ? (value as `0x${string}`) : null
}

export async function badgeVoucher(room: RoomWithRelations, memberId: string | null, badge: BadgeId) {
    const contract = badgeContractAddress()
    const key = signerKey()
    if (!contract || !key) throw new ApiError(503, 'BADGES_NOT_ENABLED', 'badges cannot be minted yet')
    if (!memberId) throw badRequest('pick who you are in this tribu first', 'MEMBER_TOKEN_REQUIRED')
    const member = room.members.find((candidate) => candidate.id === memberId)
    // Only a wallet linked through Lemon's signed sign-in: the person proved they hold it.
    if (!member?.walletAddress || !isAddress(member.walletAddress))
        throw badRequest('link your Lemon wallet first', 'BADGE_NO_WALLET')
    if (!badgesInRoom(toRoomState(room), memberId).has(badge))
        throw badRequest('this badge was not earned here', 'BADGE_NOT_EARNED')

    const tokenId = badgeTokenId(badge)
    const signature = await privateKeyToAccount(key).signTypedData({
        domain: { name: 'TribuBadges', version: '1', chainId: lemonNetwork().chainId, verifyingContract: contract },
        types: {
            Mint: [
                { name: 'to', type: 'address' },
                { name: 'id', type: 'uint256' },
            ],
        },
        primaryType: 'Mint',
        message: { to: member.walletAddress as `0x${string}`, id: BigInt(tokenId) },
    })
    return { contract, tokenId, signature, wallet: member.walletAddress }
}

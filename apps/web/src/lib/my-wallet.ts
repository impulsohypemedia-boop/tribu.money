/**
 * The wallet this device's person wants to be paid at, kept once on the device so "Yo" can put it
 * on every tribu at the same time. Each tribu still stores its own copy on the member (only the
 * member can change it), so this is a convenience, never the source of truth.
 */
import { isPayoutNetwork, isPayoutToken, type PayoutNetwork, type PayoutToken } from './payout'

export const MY_WALLET_KEY = 'ps:wallet'

export interface MyWallet {
    token: PayoutToken
    network: PayoutNetwork
    address: string
}

export function readMyWallet(): MyWallet | null {
    try {
        const raw = window.localStorage.getItem(MY_WALLET_KEY)
        if (!raw) return null
        const { token, network, address } = JSON.parse(raw) as Record<string, unknown>
        if (!isPayoutToken(token) || !isPayoutNetwork(network) || typeof address !== 'string' || !address) return null
        return { token, network, address }
    } catch {
        return null
    }
}

export function writeMyWallet(wallet: MyWallet | null): void {
    try {
        if (wallet) window.localStorage.setItem(MY_WALLET_KEY, JSON.stringify(wallet))
        else window.localStorage.removeItem(MY_WALLET_KEY)
    } catch {
        // Private mode: the tribus still get it; only the device copy is lost.
    }
}

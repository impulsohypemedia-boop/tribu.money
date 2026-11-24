/**
 * How this device's person wants to be paid, kept once on the device so "Yo" can put it on every
 * tribu at the same time, and a tribu joined later can pick it up. Each tribu still stores its own
 * copy on the member (only the member can change it), so this is a convenience, never the source of
 * truth.
 */
import { isPayoutNetwork, isPayoutToken, paymentMethodsOf, type MemberPayout, type PaymentMethods } from './payout'
import type { ApiMember, MemberProfileInput } from './api-types'

export const MY_PAYMENT_PROFILE_KEY = 'ps:payment-profile'
/** Where "Mi wallet" was kept before the profile also held a bank alias and a Lemon tag. */
const LEGACY_WALLET_KEY = 'ps:wallet'

export type MyPaymentProfile = PaymentMethods

const cryptoFrom = (value: unknown): MemberPayout | null => {
    if (!value || typeof value !== 'object') return null
    const { token, network, address } = value as Record<string, unknown>
    if (!isPayoutToken(token) || !isPayoutNetwork(network) || typeof address !== 'string' || !address) return null
    return { token, network, address }
}

const textFrom = (value: unknown): string | null => (typeof value === 'string' && value ? value : null)

export function readMyPaymentProfile(): MyPaymentProfile | null {
    try {
        const raw = window.localStorage.getItem(MY_PAYMENT_PROFILE_KEY)
        if (raw) {
            const parsed = JSON.parse(raw) as Record<string, unknown>
            return {
                bank: textFrom(parsed.bank),
                lemonTag: textFrom(parsed.lemonTag),
                crypto: cryptoFrom(parsed.crypto),
            }
        }
        const legacy = window.localStorage.getItem(LEGACY_WALLET_KEY)
        const crypto = legacy ? cryptoFrom(JSON.parse(legacy)) : null
        return crypto ? { bank: null, lemonTag: null, crypto } : null
    } catch {
        return null
    }
}

export function writeMyPaymentProfile(profile: MyPaymentProfile): void {
    try {
        window.localStorage.setItem(MY_PAYMENT_PROFILE_KEY, JSON.stringify(profile))
        window.localStorage.removeItem(LEGACY_WALLET_KEY)
    } catch {
        // Private mode: the tribus still get it; only the device copy is lost.
    }
}

/** The profile as the body of a member-profile update. */
export const profileInput = (profile: MyPaymentProfile): MemberProfileInput => ({
    bank: profile.bank,
    lemonTag: profile.lemonTag,
    payout: profile.crypto,
})

/** Whether this tribu's member already holds exactly this profile. */
export function memberHasProfile(member: ApiMember | undefined, profile: MyPaymentProfile): boolean {
    if (!member) return false
    const saved = paymentMethodsOf({ ...member, lemonTag: null })
    return (
        saved.bank === profile.bank &&
        saved.lemonTag === profile.lemonTag &&
        saved.crypto?.token === profile.crypto?.token &&
        saved.crypto?.network === profile.crypto?.network &&
        saved.crypto?.address === profile.crypto?.address
    )
}

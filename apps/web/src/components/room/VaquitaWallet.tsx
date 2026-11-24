'use client'

import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useLocale, useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { useInLemon, useLemon } from '@/components/lemon/LemonProvider'
import { BaseInput } from '@/components/ui/BaseInput'
import { Button } from '@/components/ui/Button'
import { Icon } from '@/components/ui/Icon'
import { api, ApiRequestError } from '@/lib/api'
import type { ApiPot, ApiPotWallet, RoomState } from '@/lib/api-types'
import { cn } from '@/lib/cn'
import { useErrorMessage } from '@/lib/error-messages'
import {
    availableStablecoins,
    formatTokenUnits,
    lemonNetwork,
    sameAddress,
    type StablecoinSymbol,
} from '@/lib/lemon/chain'
import type { StablecoinPaymentResult } from '@/lib/lemon/client'
import {
    formatUsd,
    majorityOf,
    parseTokenAmount,
    randomMemo,
    VAQUITA_MAX_MEMBERS,
    vaquitaContract,
} from '@/lib/lemon/vaquita'
import {
    createVaquitaWallet,
    depositToVaquita,
    proposeFromVaquita,
    voteOnVaquita,
    withdrawFromVaquita,
} from '@/lib/lemon/vaquita-client'
import { activeMembers } from '@/lib/members'
import { seedRoomState } from '@/lib/queries/core'
import { TOAST_MS } from '@/lib/toasts'
import { MemberChips } from './Vaquita'

type Props = { pot: ApiPot; slug: string; state: RoomState; meId?: string | null; token?: string | null }

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/** The wallet address this phone signs with: Lemon's session first, else the member's linked one. */
function useMyWallet(state: RoomState, meId?: string | null): string | null {
    const { session } = useLemon()
    const linked = state.members.find((member) => member.id === meId)?.walletAddress ?? null
    return (session?.wallet ?? linked)?.toLowerCase() ?? null
}

/**
 * Offer to move a vaquita's money into a real wallet. Only inside Lemon, where members can sign,
 * and only once the contract is deployed. Members who linked a wallet are in from the start; the
 * rest can be added later with the pot's approvals.
 */
export function VaquitaWalletOffer({ pot, slug, state, meId, token }: Props) {
    const t = useTranslations('room.pot.wallet')
    const errorMessage = useErrorMessage()
    const queryClient = useQueryClient()
    const inLemon = useInLemon()
    const myWallet = useMyWallet(state, meId)
    const contract = vaquitaContract()
    const coins = availableStablecoins()
    const withWallet = activeMembers(state.members).filter((member) => member.walletAddress)
    const [open, setOpen] = useState(false)
    const [coin, setCoin] = useState<StablecoinSymbol>(coins[0]?.symbol ?? 'USDC')
    const [approvals, setApprovals] = useState(() => majorityOf(Math.max(1, withWallet.length)))
    const [busy, setBusy] = useState(false)

    if (!contract || !inLemon || pot.closedAt || pot.walletPotId) return null

    const iAmIn = !!myWallet && withWallet.some((member) => sameAddress(member.walletAddress, myWallet))
    const wallets = withWallet.slice(0, VAQUITA_MAX_MEMBERS).map((member) => member.walletAddress!)
    const count = wallets.length

    const create = async () => {
        const config = lemonNetwork().tokens[coin]
        if (!config || !myWallet) return
        setBusy(true)
        try {
            const result = await createVaquitaWallet({
                contract,
                potId: pot.id,
                token: config,
                members: wallets,
                approvalsNeeded: Math.min(approvals, count),
                title: t('lemonTitleCreate'),
            })
            if (result.status !== 'sent') {
                if (result.status === 'failed') toast.error(t('failed'), { duration: TOAST_MS.actionable })
                return
            }
            // The transaction may still be mining; the server answers 409 until it can see the wallet.
            for (let attempt = 0; attempt < 12; attempt++) {
                try {
                    const fresh = await api.linkPotWallet(slug, pot.id, myWallet, token)
                    seedRoomState(queryClient, slug, fresh)
                    toast(t('created'), { duration: TOAST_MS.actionable })
                    return
                } catch (error) {
                    if (!(error instanceof ApiRequestError && error.code === 'VAQUITA_WALLET_PENDING')) throw error
                    await sleep(3000)
                }
            }
            toast(t('stillMining'), { duration: TOAST_MS.actionable })
        } catch (error) {
            toast.error(errorMessage(error), { duration: TOAST_MS.actionable })
        } finally {
            setBusy(false)
        }
    }

    return (
        <section className="grid gap-3 rounded-sm border-2 border-n-1 bg-white p-4" data-testid="vaquita-wallet-offer">
            <div className="flex items-start gap-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary-3">
                    <Icon name="wallet" size={18} />
                </span>
                <span className="grid gap-1 text-sm">
                    <span className="font-bold">{t('offerTitle')}</span>
                    <span className="text-grey-1">{t('offerBody')}</span>
                </span>
            </div>
            {!open ? (
                <Button variant="stroke" onClick={() => setOpen(true)} disabled={!iAmIn}>
                    {t('offerCta')}
                </Button>
            ) : (
                <div className="grid gap-3 text-sm">
                    <p>
                        {t('whoIsIn', {
                            names: withWallet.map((member) => member.name).join(', '),
                        })}
                    </p>
                    {activeMembers(state.members).length > count && <p className="text-grey-1">{t('othersLater')}</p>}
                    <div className="grid gap-1">
                        <span className="font-bold">{t('approvalsLabel')}</span>
                        <div className="flex flex-wrap gap-2" role="radiogroup">
                            {Array.from({ length: count }, (_, i) => i + 1).map((n) => (
                                <button
                                    key={n}
                                    type="button"
                                    role="radio"
                                    aria-checked={approvals === n}
                                    onClick={() => setApprovals(n)}
                                    className={cn(
                                        'rounded-full border border-n-1 px-3 py-1.5 font-bold',
                                        approvals === n ? 'bg-n-1 text-white' : 'bg-white'
                                    )}
                                >
                                    {t('approvalsOption', { n, count })}
                                </button>
                            ))}
                        </div>
                        <span className="text-grey-1">{t('approvalsHint')}</span>
                    </div>
                    {coins.length > 1 && (
                        <div className="grid gap-1">
                            <span className="font-bold">{t('coinLabel')}</span>
                            <div className="flex gap-2" role="radiogroup">
                                {coins.map((option) => (
                                    <button
                                        key={option.symbol}
                                        type="button"
                                        role="radio"
                                        aria-checked={coin === option.symbol}
                                        onClick={() => setCoin(option.symbol)}
                                        className={cn(
                                            'rounded-full border border-n-1 px-3 py-1.5 font-bold',
                                            coin === option.symbol ? 'bg-n-1 text-white' : 'bg-white'
                                        )}
                                    >
                                        {option.symbol}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                    <p className="text-grey-1">{t('riskNote')}</p>
                    <Button
                        shadowSize="4"
                        loading={busy}
                        onClick={() => void create()}
                        data-testid="vaquita-wallet-create"
                    >
                        {t('createCta')}
                    </Button>
                </div>
            )}
            {!iAmIn && <p className="text-sm text-grey-1">{t('linkFirst')}</p>}
        </section>
    )
}

type Form = null | 'deposit' | 'pay' | 'withdraw'

/** The vaquita's wallet as the chain has it, and what a member can do with it from Lemon. */
export function VaquitaWallet({ pot, slug, state, meId, token }: Props) {
    const t = useTranslations('room.pot.wallet')
    const locale = useLocale()
    const errorMessage = useErrorMessage()
    const inLemon = useInLemon()
    const myWallet = useMyWallet(state, meId)
    const contract = vaquitaContract()
    const query = useQuery({
        queryKey: ['pot-wallet', slug, pot.id],
        queryFn: () => api.potWallet(slug, pot.id),
        enabled: !!contract && !!pot.walletPotId,
        refetchInterval: 30_000,
    })
    const [form, setForm] = useState<Form>(null)
    const [amount, setAmount] = useState('')
    const [note, setNote] = useState('')
    const [payTo, setPayTo] = useState('')
    const [problem, setProblem] = useState<string | null>(null)
    const [busy, setBusy] = useState(false)

    if (!contract || !pot.walletPotId) return null
    const wallet = query.data
    if (!wallet) {
        return (
            <section
                className="rounded-sm border-2 border-n-1 bg-white p-4 text-sm text-grey-1"
                data-testid="vaquita-wallet"
            >
                {query.isError ? t('readFailed') : t('reading')}
            </section>
        )
    }

    const usd = (units: string | bigint) => formatUsd(BigInt(units), wallet.decimals, locale)
    const nameOf = (memberId: string | null, address: string) =>
        state.members.find((member) => member.id === memberId)?.name ?? `${address.slice(0, 6)}…${address.slice(-4)}`
    const mine = wallet.members.find((member) => sameAddress(member.wallet, myWallet))
    const canAct = inLemon && !!mine
    const coin = lemonNetwork().tokens[wallet.token]
    const walletPotId = wallet.walletPotId
    // Anyone in the tribu with a linked wallet can be paid: the pot's members and everyone else.
    const payees = activeMembers(state.members).filter((member) => member.walletAddress)
    const notYetIn = payees.filter((member) => !wallet.members.some((m) => sameAddress(m.wallet, member.walletAddress)))

    /** Ask the chain again a few times while Lemon's transaction is mined. */
    const refreshSoon = () => {
        for (const delay of [3000, 8000, 15000, 30000]) setTimeout(() => void query.refetch(), delay)
    }

    const run = async (send: () => Promise<StablecoinPaymentResult>, done: string) => {
        setBusy(true)
        setProblem(null)
        try {
            const result = await send()
            if (result.status === 'sent') {
                toast(done, { duration: TOAST_MS.actionable })
                setForm(null)
                setAmount('')
                setNote('')
                refreshSoon()
            } else if (result.status === 'failed') {
                setProblem(t('failed'))
            }
        } catch (error) {
            setProblem(errorMessage(error))
        } finally {
            setBusy(false)
        }
    }

    const submit = async () => {
        if (!coin) return
        const units = parseTokenAmount(amount, wallet.decimals)
        if (units === null) return setProblem(t('amountInvalid'))
        if (form === 'deposit') {
            return run(
                () => depositToVaquita({ contract, walletPotId, token: coin, units, title: t('lemonTitleDeposit') }),
                t('depositSent')
            )
        }
        if (form === 'withdraw') {
            if (units > BigInt(mine?.partUnits ?? '0')) return setProblem(t('moreThanYours'))
            return run(
                () => withdrawFromVaquita({ contract, walletPotId, units, title: t('lemonTitleWithdraw') }),
                t('withdrawSent')
            )
        }
        const target = payees.find((member) => member.id === payTo)?.walletAddress
        if (!target) return setProblem(t('payToMissing'))
        if (units > BigInt(wallet.totalUnits)) return setProblem(t('moreThanPot'))
        const memo = randomMemo()
        return run(
            async () => {
                if (note.trim()) await api.addPotWalletNote(slug, pot.id, { memo, text: note.trim() }, token)
                return proposeFromVaquita({
                    contract,
                    walletPotId,
                    action: 'Pay',
                    target,
                    amount: units,
                    memo,
                    title: t('lemonTitlePay'),
                })
            },
            wallet.approvalsNeeded > 1 ? t('paySentNeedsApprovals') : t('paySent')
        )
    }

    const addMember = (address: string) =>
        run(
            () =>
                proposeFromVaquita({
                    contract,
                    walletPotId,
                    action: 'AddMember',
                    target: address,
                    amount: 0n,
                    memo: `0x${'00'.repeat(32)}`,
                    title: t('lemonTitleAdd'),
                }),
            t('addSent')
        )

    const vote = (proposalId: number, functionName: 'approve' | 'execute' | 'cancel') =>
        run(
            () => voteOnVaquita({ contract, walletPotId, proposalId, functionName, title: t('lemonTitleVote') }),
            t('voteSent')
        )

    const describe = (proposal: ApiPotWallet['proposals'][number]) => {
        const who = nameOf(proposal.targetMemberId, proposal.target)
        if (proposal.action === 'Pay') return t('proposalPay', { amount: usd(proposal.amountUnits), name: who })
        if (proposal.action === 'AddMember') return t('proposalAdd', { name: who })
        if (proposal.action === 'RemoveMember') return t('proposalRemove', { name: who })
        return t('proposalApprovals', { n: Number(proposal.amountUnits) })
    }

    const open = wallet.proposals.filter((proposal) => proposal.status === 'open')
    const recent = wallet.proposals.filter((proposal) => proposal.status !== 'open').slice(0, 5)

    return (
        <section className="grid gap-4" data-testid="vaquita-wallet">
            <div className="rounded-sm border border-n-1 bg-primary-3/40 p-4 text-center">
                <p className="text-sm text-grey-1">{t('heldTitle', { coin: wallet.token })}</p>
                <p className="text-h3 font-bold">{usd(wallet.totalUnits)}</p>
                {mine && <p className="text-sm">{t('yourPart', { amount: usd(mine.partUnits) })}</p>}
            </div>

            <div className="flex items-start gap-3 rounded-sm border-2 border-n-1 bg-white p-3 text-sm">
                <Icon name="check" size={18} className="mt-0.5 shrink-0" />
                <span className="grid gap-0.5">
                    <span className="font-bold">
                        {t('rulesLine', { n: wallet.approvalsNeeded, count: wallet.members.length })}
                    </span>
                    <span className="text-grey-1">{t('rulesNote')}</span>
                </span>
            </div>

            {canAct && (
                <div className="grid grid-cols-3 gap-2">
                    {(['deposit', 'pay', 'withdraw'] as const).map((kind) => (
                        <Button
                            key={kind}
                            variant={form === kind ? 'primary' : 'stroke'}
                            width="auto"
                            className="justify-center px-2 text-sm"
                            onClick={() => {
                                setForm(form === kind ? null : kind)
                                setProblem(null)
                            }}
                        >
                            {t(`action_${kind}`)}
                        </Button>
                    ))}
                </div>
            )}
            {!inLemon && <p className="text-sm text-grey-1">{t('openInLemon')}</p>}
            {inLemon && !mine && <p className="text-sm text-grey-1">{t('notInWallet')}</p>}

            {form && (
                <div className="grid gap-3 rounded-sm border border-n-1 bg-white p-3 text-sm">
                    {form === 'pay' && (
                        <>
                            <span className="font-bold">{t('payTo')}</span>
                            <MemberChips members={payees} value={payTo} onChange={setPayTo} testId="vaquita-pay-to" />
                            <BaseInput
                                value={note}
                                onChange={(event) => setNote(event.target.value)}
                                maxLength={80}
                                placeholder={t('payNotePlaceholder')}
                            />
                        </>
                    )}
                    <label className="grid gap-1">
                        <span className="font-bold">{t('amountLabel', { coin: wallet.token })}</span>
                        <BaseInput
                            inputMode="decimal"
                            value={amount}
                            onChange={(event) => setAmount(event.target.value)}
                            placeholder="0,00"
                        />
                    </label>
                    {form === 'withdraw' && mine && (
                        <button
                            type="button"
                            className="justify-self-start text-sm font-bold underline"
                            onClick={() => setAmount(formatTokenUnits(BigInt(mine.partUnits), wallet.decimals))}
                        >
                            {t('allMine', { amount: usd(mine.partUnits) })}
                        </button>
                    )}
                    <p className="text-grey-1">{t(`note_${form}`)}</p>
                    {problem && <p className="font-bold text-error-1">{problem}</p>}
                    <Button shadowSize="4" loading={busy} onClick={() => void submit()}>
                        {t(`submit_${form}`)}
                    </Button>
                </div>
            )}
            {!form && problem && <p className="text-sm font-bold text-error-1">{problem}</p>}

            {open.length > 0 && (
                <section className="grid gap-2">
                    <h3 className="text-h8 uppercase tracking-wide text-grey-1">{t('pendingTitle')}</h3>
                    <ul className="grid gap-2">
                        {open.map((proposal) => {
                            const approvedByMe = proposal.approvedBy.some((address) => sameAddress(address, myWallet))
                            const ready = proposal.approvedBy.length >= wallet.approvalsNeeded
                            return (
                                <li
                                    key={proposal.id}
                                    className="grid gap-2 rounded-sm border border-n-1 bg-white p-3 text-sm"
                                >
                                    <span className="font-bold">{describe(proposal)}</span>
                                    {proposal.note && <span>{proposal.note}</span>}
                                    <span className="text-grey-1">
                                        {t('approvalsSoFar', {
                                            n: proposal.approvedBy.length,
                                            needed: wallet.approvalsNeeded,
                                        })}
                                    </span>
                                    {canAct && (
                                        <span className="flex flex-wrap gap-2">
                                            {!approvedByMe && (
                                                <Button
                                                    width="auto"
                                                    size="small"
                                                    onClick={() => void vote(proposal.id, 'approve')}
                                                >
                                                    {t('approve')}
                                                </Button>
                                            )}
                                            {ready && (
                                                <Button
                                                    width="auto"
                                                    size="small"
                                                    onClick={() => void vote(proposal.id, 'execute')}
                                                >
                                                    {t('execute')}
                                                </Button>
                                            )}
                                            {sameAddress(proposal.proposer, myWallet) && (
                                                <Button
                                                    variant="stroke"
                                                    width="auto"
                                                    size="small"
                                                    onClick={() => void vote(proposal.id, 'cancel')}
                                                >
                                                    {t('cancelProposal')}
                                                </Button>
                                            )}
                                        </span>
                                    )}
                                </li>
                            )
                        })}
                    </ul>
                </section>
            )}

            <section className="grid gap-2">
                <h3 className="text-h8 uppercase tracking-wide text-grey-1">{t('partsTitle')}</h3>
                <ul className="grid gap-1 text-sm">
                    {wallet.members.map((member) => (
                        <li key={member.wallet} className="flex justify-between gap-2">
                            <span className="truncate">{nameOf(member.memberId, member.wallet)}</span>
                            <span className="shrink-0 font-bold">{usd(member.partUnits)}</span>
                        </li>
                    ))}
                </ul>
                {canAct && notYetIn.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                        {notYetIn.map((member) => (
                            <button
                                key={member.id}
                                type="button"
                                className="rounded-full border border-n-1 bg-white px-3 py-1.5 text-sm font-bold"
                                onClick={() => void addMember(member.walletAddress!)}
                            >
                                {t('addMember', { name: member.name })}
                            </button>
                        ))}
                    </div>
                )}
            </section>

            {recent.length > 0 && (
                <section className="grid gap-2">
                    <h3 className="text-h8 uppercase tracking-wide text-grey-1">{t('historyTitle')}</h3>
                    <ul className="grid gap-1 text-sm">
                        {recent.map((proposal) => (
                            <li key={proposal.id} className="flex justify-between gap-2">
                                <span className="truncate">
                                    {describe(proposal)}
                                    {proposal.note ? ` · ${proposal.note}` : ''}
                                </span>
                                <span className="shrink-0 text-grey-1">{t(`status_${proposal.status}`)}</span>
                            </li>
                        ))}
                    </ul>
                </section>
            )}
        </section>
    )
}

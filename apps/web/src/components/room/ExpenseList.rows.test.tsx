import { createElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

import type { ApiExpense, RoomState } from '@/lib/api-types'

vi.mock('next/image', () => ({
    default: ({ unoptimized: _unoptimized, ...props }: Record<string, unknown>) => createElement('img', props),
}))

vi.mock('motion/react', () => {
    const element = (tag: 'div' | 'li' | 'section') =>
        function MotionElement({
            animate: _animate,
            exit: _exit,
            initial: _initial,
            layout: _layout,
            transition: _transition,
            children,
            ...props
        }: Record<string, unknown> & { children?: ReactNode }) {
            return createElement(tag, props, children)
        }

    return {
        AnimatePresence: ({ children }: { children?: ReactNode }) => children,
        motion: {
            div: element('div'),
            li: element('li'),
            section: element('section'),
        },
    }
})

vi.mock('next-intl', () => ({
    useLocale: () => 'en',
    useTranslations: () => (key: string, values?: Record<string, string>) =>
        values ? `${key}:${Object.values(values).join(',')}` : key,
}))

vi.mock('@/components/ui/Doodle', () => ({
    Doodle: ({ name, label, size, weight }: { name: string; label?: string; size?: number; weight?: number }) =>
        createElement('span', {
            'aria-label': label,
            'aria-hidden': label ? undefined : true,
            'data-doodle-name': name,
            'data-doodle-size': size,
            'data-doodle-weight': weight,
        }),
}))

vi.mock('@/lib/offline-queue', () => ({
    isQueuedExpenseId: () => false,
    useQueuedWrites: () => [],
}))

vi.mock('@/lib/use-motion', () => ({ useMotionAllowed: () => false }))
vi.mock('./Money', () => ({ Money: () => createElement('span', null, 'money') }))
vi.mock('./ReactionBar', () => ({ ReactionBar: () => null }))
vi.mock('./SettlementRow', () => ({ SettlementRow: () => null }))

import { ExpenseList } from './ExpenseList'

const expense = (description: string, overrides: Partial<ApiExpense> = {}): ApiExpense => ({
    id: 'expense',
    description,
    amountMinor: '4000',
    currency: 'USD',
    baseAmountMinor: '4000',
    fxRate: '1',
    splitMode: 'EQUAL',
    paidById: 'ana',
    createdById: 'ana',
    date: '2026-08-03T12:00:00.000Z',
    category: null,
    createdAt: '2026-08-03T12:00:00.000Z',
    shares: [
        { memberId: 'ana', amountMinor: '2000', enteredAmountMinor: null, splitWeight: null },
        { memberId: 'bea', amountMinor: '2000', enteredAmountMinor: null, splitWeight: null },
    ],
    reactions: [],
    ...overrides,
})

const state = (description: string, overrides: Partial<ApiExpense> = {}): RoomState => ({
    room: {
        id: 'room',
        slug: 'summer-trip',
        name: 'Summer trip',
        emoji: null,
        currency: 'USD',
        coverUrl: null,
        theme: null,
        createdAt: '2026-08-03T10:00:00.000Z',
    },
    members: [
        { id: 'ana', name: 'Ana', avatar: 'tribu', createdAt: '2026-08-03T10:00:00.000Z' },
        { id: 'bea', name: 'Bea', avatar: 'bee', createdAt: '2026-08-03T10:00:00.000Z' },
    ],
    expenses: [expense(description, overrides)],
    settlements: [],
    balances: { ana: '2000', bea: '-2000' },
    suggestedTransfers: [{ fromId: 'bea', toId: 'ana', amountMinor: '2000' }],
})

const renderExpense = (description: string, overrides: Partial<ApiExpense> = {}) =>
    renderToStaticMarkup(
        <ExpenseList
            state={state(description, overrides)}
            currencies={[{ code: 'USD', symbol: '$', name: 'US dollar', decimals: 2, hasRate: true }]}
            meId="bea"
            slug="summer-trip"
            token="member-token"
            onSelect={() => undefined}
            onShare={() => undefined}
            onAdd={() => undefined}
        />
    )

describe('ExpenseList rows', () => {
    it('draws no illustration next to an expense', () => {
        const card = renderExpense('Pizza')

        expect(card).not.toContain('data-doodle-name')
        expect(card).not.toContain('data-expense-subject')
    })

    it('keeps the payer identity in the card copy', () => {
        const card = renderExpense('Pizza')

        expect(card).toContain('paidByCompact:Ana')
    })

    it('shows a custom FX rate as frozen on this expense row', () => {
        const card = renderExpense('First round', {
            currency: 'BEER',
            amountMinor: '400',
            baseAmountMinor: '200',
            fxRate: '0.5',
        })

        expect(card).toContain('data-testid="expense-saved-fx-rate"')
        expect(card).toContain('savedManualRate:BEER,0.5,USD')
    })

    it('marks an expense a monthly schedule created as a subscription, and offers the filter', () => {
        const card = renderExpense('Netflix', { recurringId: 'monthly-netflix' })

        expect(card).toContain('data-testid="expense-recurring-chip"')
        expect(card).toContain('monthlyChip')
        expect(card).toContain('data-testid="expense-filter"')
        expect(card).toContain('filterSubscriptions')
    })

    it('hides the subscription filter while no expense repeats', () => {
        const card = renderExpense('Pizza')

        expect(card).not.toContain('data-testid="expense-filter"')
        expect(card).not.toContain('data-testid="expense-recurring-chip"')
    })
})

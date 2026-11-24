'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { cn } from '@/lib/cn'
import { HeroCreateForm } from './HeroCreateForm'

const GROUPS = ['couple', 'home', 'friends', 'family', 'team'] as const

/**
 * The real create form, introduced by the kinds of group a tribu is for. Tapping a group fills
 * the name so the emblem and link preview follow it; the person can still type any name.
 */
export function StartTribu() {
    const t = useTranslations('marketing.landingGroups')
    const [name, setName] = useState('')

    return (
        <section id="armar" className="mx-auto w-full max-w-2xl scroll-mt-6 px-5 pb-10">
            <h2 className="font-display text-2xl font-extrabold text-n-1">{t('title')}</h2>
            <p className="mt-2 text-sm leading-5 text-n-1/70">{t('body')}</p>
            <div className="mt-4 flex flex-wrap gap-2" data-testid="landing-group-kinds">
                {GROUPS.map((group) => {
                    const label = t(group)
                    const selected = name === label
                    return (
                        <button
                            key={group}
                            type="button"
                            aria-pressed={selected}
                            onClick={() => setName(label)}
                            className={cn(
                                'rounded-full border px-4 py-2 text-sm font-bold transition-colors',
                                selected ? 'border-n-1 bg-n-1 text-white' : 'border-n-1/20 bg-white text-n-1'
                            )}
                        >
                            {label}
                        </button>
                    )
                })}
            </div>
            <HeroCreateForm roomName={name} onRoomNameChange={setName} />
        </section>
    )
}

export default StartTribu

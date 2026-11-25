'use client'

import { useTranslations } from 'next-intl'
import { useRovingRadioGroup } from '@/components/ui/use-roving-radio-group'
import { effectiveAvatarPaletteKey, type AvatarPaletteKey } from '@/lib/avatar-palettes'
import { AVATARS, RONDA_KEYS, type AvatarKey } from '@/lib/avatars'
import { cn } from '@/lib/cn'
import { rondaFor } from '@/lib/ronda-cast'
import { MemberAvatar } from './MemberAvatar'

interface AvatarPickerProps {
    name: string
    /** Null is possible only while legacy rows are being backfilled. */
    value: string | null
    /** Null is possible only during a rolling deploy or from an older cache. */
    palette: string | null
    /** Effective palette keys rendered by every other active room member. */
    usedPalettes?: readonly string[]
    onChange: (avatar: string, palette: AvatarPaletteKey) => void
    disabled?: boolean
}

const OPTIONS: AvatarKey[] = [...RONDA_KEYS]

/**
 * The six characters of La Ronda, all on one 3×2 grid. A member whose row still holds an older
 * key sees the character it is drawn as marked, so the grid always agrees with the avatar shown
 * everywhere else. Selection happens only by tapping a character.
 *
 * Member rows still store a palette key next to the character. The cast wears its own colours,
 * so a pick keeps the member's current palette unchanged.
 */
export function AvatarPicker({ name, value, palette, onChange, disabled }: AvatarPickerProps) {
    const t = useTranslations('room.avatar')
    const shownAs = rondaFor(value, name)
    const currentPalette = effectiveAvatarPaletteKey(palette, value ?? name)
    // The member keeps the palette they have: the cast does not render it.
    const paletteFor = (_key: AvatarKey) => currentPalette

    const { getRadioProps } = useRovingRadioGroup({
        options: OPTIONS,
        value: shownAs,
        disabled: false,
        onChange: (key) => {
            if (disabled) return false
            onChange(key, paletteFor(key))
            return true
        },
    })

    return (
        <div
            role="radiogroup"
            aria-label={t('titleFor', { name })}
            data-testid="avatar-picker"
            className="grid grid-cols-3 gap-2"
        >
            {OPTIONS.map((key) => {
                const art = AVATARS[key]
                const selected = key === shownAs
                return (
                    <button
                        key={key}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        {...getRadioProps(key)}
                        aria-disabled={disabled || undefined}
                        aria-label={t('option', { name: art.label })}
                        onClick={() => !disabled && onChange(key, paletteFor(key))}
                        data-testid="avatar-option"
                        data-avatar={key}
                        className={cn(
                            'flex min-w-0 flex-col items-center justify-center gap-1.5 rounded-2xl border-2 border-n-1 p-2 text-center transition-transform duration-100',
                            selected ? 'bg-primary-1 shadow-[3px_3px_0_#141414]' : 'bg-white active:translate-y-[2px]',
                            disabled && 'opacity-50'
                        )}
                    >
                        <MemberAvatar name={name} avatar={key} size={56} />
                        <span className="flex w-full min-w-0 flex-col gap-0.5">
                            <span className="font-display text-sm leading-tight" data-testid="avatar-option-title">
                                {art.label}
                            </span>
                            <span
                                className="line-clamp-2 text-[11px] leading-tight text-n-1/70"
                                data-testid="avatar-option-description"
                            >
                                {art.vibe}
                            </span>
                        </span>
                    </button>
                )
            })}
        </div>
    )
}

'use client'

import Image from 'next/image'
import { cn } from '@/lib/cn'
import { RONDA_HEADS, rondaFor } from '@/lib/ronda-cast'

/**
 * A member's character from La Ronda, Tribu's cast: the head on cream.
 *
 * Every stored key draws one of the cast. Older keys map to a character by a stable hash, so a
 * room that predates the cast changes look without changing data. `palette` is still accepted
 * because member rows carry it, but the cast always wears its own colours.
 */
export function MemberAvatar({
    name,
    avatar,
    size = 32,
    className,
}: {
    name: string
    /** Null/undefined/unknown → a character picked from the name. */
    avatar?: string | null
    palette?: string | null
    size?: number
    className?: string
}) {
    const key = rondaFor(avatar, name)

    return (
        <span
            className={cn(
                'relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full border-[1.5px] border-n-1 bg-background',
                className
            )}
            style={{ width: size, height: size }}
            aria-hidden="true"
            data-ronda={key}
        >
            <Image src={RONDA_HEADS[key]} alt="" unoptimized width={size} height={size} className="size-full" />
        </span>
    )
}

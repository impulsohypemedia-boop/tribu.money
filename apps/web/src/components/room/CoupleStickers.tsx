/**
 * The couple's stickers, drawn in the Ronda style: flat colour from the logo ring, a thick ink
 * outline and a little tilt. Decoration only, so every one is aria-hidden.
 */
const INK = '#141414'

type StickerProps = { size?: number; className?: string }

export const RONDA_PINK = '#FF7AC6'
export const RONDA_ORANGE = '#FF9F1C'
export const RONDA_TEAL = '#14B8B0'
export const RONDA_LIME = '#B9D43A'
export const RONDA_VIOLET = '#6E5BFF'
export const RONDA_YELLOW = '#FFD23F'

export function HeartSticker({ size = 32, className }: StickerProps) {
    return (
        <svg viewBox="0 0 32 32" width={size} height={size} className={className} aria-hidden="true">
            <path
                d="M16 27.5C8.5 22.4 3.5 17.8 3.5 11.6 3.5 7.6 6.6 4.5 10.4 4.5c2.4 0 4.4 1.2 5.6 3.1 1.2-1.9 3.2-3.1 5.6-3.1 3.8 0 6.9 3.1 6.9 7.1 0 6.2-5 10.8-12.5 15.9Z"
                fill={RONDA_PINK}
                stroke={INK}
                strokeWidth="2.4"
                strokeLinejoin="round"
            />
            <path d="M9 10.5c.4-1.6 1.6-2.6 3-2.8" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
        </svg>
    )
}

export function PawSticker({ size = 32, className }: StickerProps) {
    return (
        <svg viewBox="0 0 32 32" width={size} height={size} className={className} aria-hidden="true">
            <g fill={RONDA_ORANGE} stroke={INK} strokeWidth="2.2" strokeLinejoin="round">
                <path d="M16 15.5c-4.6 0-8.5 4.4-8.5 8.1 0 2.4 1.9 3.6 4 3.6 1.8 0 2.8-.9 4.5-.9s2.7.9 4.5.9c2.1 0 4-1.2 4-3.6 0-3.7-3.9-8.1-8.5-8.1Z" />
                <ellipse cx="6.2" cy="13.2" rx="2.7" ry="3.4" transform="rotate(-18 6.2 13.2)" />
                <ellipse cx="11.6" cy="7.6" rx="2.8" ry="3.6" transform="rotate(-6 11.6 7.6)" />
                <ellipse cx="20.4" cy="7.6" rx="2.8" ry="3.6" transform="rotate(6 20.4 7.6)" />
                <ellipse cx="25.8" cy="13.2" rx="2.7" ry="3.4" transform="rotate(18 25.8 13.2)" />
            </g>
        </svg>
    )
}

export function PlaneSticker({ size = 32, className }: StickerProps) {
    return (
        <svg viewBox="0 0 32 32" width={size} height={size} className={className} aria-hidden="true">
            <path
                d="M28.6 4.4c-1.3-1.3-3.4-1.2-4.7.2l-4.6 4.8L7 6.3 4.3 9l9.8 5.6-4.6 4.9-4.3-.6-2.2 2.2 5.4 2.9 2.9 5.4 2.2-2.2-.6-4.3 4.9-4.6L23 28.1l2.7-2.7-3.1-12.3 4.8-4.6c1.4-1.3 1.5-3.4.2-4.7Z"
                fill={RONDA_TEAL}
                stroke={INK}
                strokeWidth="2.2"
                strokeLinejoin="round"
            />
        </svg>
    )
}

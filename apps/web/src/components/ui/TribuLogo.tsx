import { cn } from '@/lib/cn'

/** Ring colours, clockwise from the top right: one per character of the cast. */
export const RONDA_COLORS = ['#B9D43A', '#6E5BFF', '#FFD23F', '#14B8B0', '#FF7AC6', '#FF9F1C'] as const

const INK = '#141414'
const CREAM = '#FFFAEE'
const PINK = '#FF7AC6'

function arc(r: number, from: number, to: number) {
    const point = (deg: number) => {
        const rad = ((deg - 90) * Math.PI) / 180
        return `${(50 + r * Math.cos(rad)).toFixed(2)} ${(50 + r * Math.sin(rad)).toFixed(2)}`
    }
    return `M${point(from)} A${r} ${r} 0 0 1 ${point(to)}`
}

/**
 * The person that stands in for the "I" of TRIBU: a pink head on an ink body. Drawn in a
 * 10x24 box so it sits on the text baseline at cap height.
 */
function Person({ tone }: { tone: 'ink' | 'light' }) {
    const body = tone === 'ink' ? INK : CREAM
    return (
        <svg viewBox="0 0 10 24" aria-hidden className="inline-block h-[0.74em] w-[0.31em] align-baseline">
            <circle cx="5" cy="4.2" r="3.6" fill={PINK} stroke={body} strokeWidth="1.3" />
            <rect x="2" y="10" width="6" height="14" rx="3" fill={body} />
        </svg>
    )
}

/**
 * The ronda: six colours in a ring, one person in the middle. Same drawing as
 * `assets/logos/tribu-mark.svg`, inline so it takes the surrounding size and needs no request.
 * `ink` is for light surfaces, `light` for dark ones.
 */
export function TribuSymbol({
    size = 32,
    tone = 'ink',
    className,
}: {
    size?: number
    tone?: 'ink' | 'light'
    className?: string
}) {
    const body = tone === 'ink' ? INK : CREAM
    const seg = 360 / RONDA_COLORS.length
    return (
        <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden className={cn('shrink-0', className)}>
            {RONDA_COLORS.map((color, i) => (
                <path
                    key={color}
                    d={arc(40, 18 + i * seg, 18 + (i + 1) * seg)}
                    stroke={color}
                    strokeWidth="16"
                    fill="none"
                />
            ))}
            <circle cx="50" cy="35" r="9.5" fill={PINK} stroke={body} strokeWidth="3.5" />
            <rect x="41" y="49" width="18" height="26" rx="9" fill={body} />
        </svg>
    )
}

/** TRIBU in the display face, the I drawn as a person. */
export function TribuWordmark({
    size = 28,
    tone = 'ink',
    className,
}: {
    size?: number
    tone?: 'ink' | 'light'
    className?: string
}) {
    return (
        <span
            aria-label="Tribu"
            role="img"
            className={cn(
                'inline-flex items-baseline font-display leading-none tracking-[0.01em]',
                tone === 'ink' ? 'text-n-1' : 'text-white',
                className
            )}
            style={{ fontSize: size }}
        >
            <span aria-hidden>TR</span>
            <span aria-hidden className="mx-[0.03em]">
                <Person tone={tone} />
            </span>
            <span aria-hidden>BU</span>
        </span>
    )
}

/** Symbol and wordmark side by side. */
export function TribuLogo({
    size = 28,
    tone = 'ink',
    className,
}: {
    size?: number
    tone?: 'ink' | 'light'
    className?: string
}) {
    return (
        <span className={cn('inline-flex items-center gap-2', className)}>
            <TribuSymbol size={size} tone={tone} />
            <TribuWordmark size={size * 0.8} tone={tone} />
        </span>
    )
}

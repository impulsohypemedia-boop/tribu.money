import { cn } from '@/lib/cn'

const HOOD = 'M0 -15 C4.5 -15 12 4 12 9.5 C12 14.5 -12 14.5 -12 9.5 C-12 4 -4.5 -15 0 -15Z'

/**
 * The ronda: five hooded people around one orange dot, the money they share. Same drawing as
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
    const hood = tone === 'ink' ? '#0D1B2A' : '#F6F4F0'
    return (
        <svg width={size} height={size} viewBox="-50 -50 100 100" aria-hidden className={cn('shrink-0', className)}>
            {[0, 72, 144, 216, 288].map((angle) => (
                <g key={angle} transform={`rotate(${angle}) translate(0 -30)`}>
                    <path d={HOOD} fill={hood} />
                    <ellipse cx="0" cy="6.5" rx="6.4" ry="5" fill="#FFE3D7" />
                    <circle cx="-2.7" cy="6" r="1.35" fill="#0D1B2A" />
                    <circle cx="2.7" cy="6" r="1.35" fill="#0D1B2A" />
                </g>
            ))}
            <circle r="8.5" fill="#FF6B35" />
        </svg>
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
            <span
                className={cn(
                    'font-display font-extrabold leading-none tracking-[-0.05em]',
                    tone === 'ink' ? 'text-n-1' : 'text-white'
                )}
                style={{ fontSize: size * 0.95 }}
            >
                tribu
            </span>
        </span>
    )
}

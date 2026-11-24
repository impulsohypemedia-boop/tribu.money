'use client'

import { useState } from 'react'
import { useLocale } from 'next-intl'
import type { PatrimonyPoint } from '@/lib/patrimony'
import { formatUsd } from './UsdMoney'

const WIDTH = 320
const HEIGHT = 140
const PAD_X = 8
const PAD_TOP = 12
const PAD_BOTTOM = 8

const monthLabel = (month: string, locale: string) => {
    const [year, m] = month.split('-').map(Number)
    return new Date(year, m - 1, 1).toLocaleDateString(locale, { month: 'short', year: '2-digit' })
}

/**
 * One line: what the tribus held at the end of each month, in dollars. Tap or hover a month to
 * read its value; the last month is selected by default.
 */
export function PatrimonyChart({ points }: { points: PatrimonyPoint[] }) {
    const locale = useLocale()
    const [selected, setSelected] = useState<number | null>(null)
    if (points.length < 2) return null

    // Display geometry only: cents to Number is safe at any amount a tribu can hold.
    const values = points.map((point) => Number(point.usdCents))
    const max = Math.max(...values, 0)
    const min = Math.min(...values, 0)
    const span = max - min || 1
    const step = (WIDTH - PAD_X * 2) / (points.length - 1)
    const x = (index: number) => PAD_X + index * step
    const y = (value: number) => PAD_TOP + (1 - (value - min) / span) * (HEIGHT - PAD_TOP - PAD_BOTTOM)
    const line = values.map((value, index) => `${index === 0 ? 'M' : 'L'}${x(index)},${y(value)}`).join(' ')
    const baseline = y(0)
    const area = `${line} L${x(points.length - 1)},${baseline} L${x(0)},${baseline} Z`

    const active = selected ?? points.length - 1
    const pick = (clientX: number, target: SVGSVGElement) => {
        const box = target.getBoundingClientRect()
        const relative = ((clientX - box.left) / box.width) * WIDTH
        setSelected(Math.max(0, Math.min(points.length - 1, Math.round((relative - PAD_X) / step))))
    }

    return (
        <figure className="m-0" data-testid="patrimony-chart">
            <p className="mb-1 flex items-baseline justify-between gap-2 text-sm">
                <span className="capitalize text-grey-1">{monthLabel(points[active].month, locale)}</span>
                <span className="font-bold">{formatUsd(points[active].usdCents, locale)}</span>
            </p>
            <svg
                viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
                className="block h-36 w-full touch-pan-y"
                role="img"
                aria-label={points
                    .map((point) => `${monthLabel(point.month, locale)}: ${formatUsd(point.usdCents, locale)}`)
                    .join(', ')}
                onPointerMove={(event) => pick(event.clientX, event.currentTarget)}
                onPointerDown={(event) => pick(event.clientX, event.currentTarget)}
                onPointerLeave={() => setSelected(null)}
            >
                <line x1={PAD_X} x2={WIDTH - PAD_X} y1={baseline} y2={baseline} stroke="#E7E8E9" strokeWidth={1} />
                <path d={area} fill="#FFE9DF" />
                <path
                    d={line}
                    fill="none"
                    stroke="#E5612C"
                    strokeWidth={2}
                    strokeLinejoin="round"
                    strokeLinecap="round"
                />
                <line
                    x1={x(active)}
                    x2={x(active)}
                    y1={PAD_TOP / 2}
                    y2={HEIGHT - PAD_BOTTOM}
                    stroke="#5F646D"
                    strokeWidth={1}
                    strokeDasharray="3 3"
                />
                <circle cx={x(active)} cy={y(values[active])} r={5} fill="#E5612C" stroke="#FFFFFF" strokeWidth={2} />
            </svg>
            <p className="mt-1 flex justify-between text-xs capitalize text-grey-1" aria-hidden="true">
                <span>{monthLabel(points[0].month, locale)}</span>
                <span>{monthLabel(points[points.length - 1].month, locale)}</span>
            </p>
        </figure>
    )
}

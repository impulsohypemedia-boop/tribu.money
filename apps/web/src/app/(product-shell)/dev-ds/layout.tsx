import type { Metadata } from 'next'

export const metadata: Metadata = {
    title: 'Design system — Tribu',
    description: 'The code-derived Tribu design system and implementation audit.',
    robots: { index: false, follow: false },
}

export default function DesignSystemLayout({ children }: { children: React.ReactNode }) {
    return children
}

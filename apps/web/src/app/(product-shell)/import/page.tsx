import type { Metadata } from 'next'
import { Breadcrumbs } from '@/components/marketing/Breadcrumbs'
import { SplitwiseImport } from '@/components/import/SplitwiseImport'
import { appPageMetadata } from '@/lib/seo'

export const metadata: Metadata = {
    ...appPageMetadata({
        title: 'Importar desde Splitwise',
        description: 'Traé tus grupos de Splitwise o Split Pro a Tribu.',
        path: '/import',
        type: 'website',
    }),
    robots: { index: false, follow: true },
}

const crumbs = [
    { name: 'Inicio', href: '/app' },
    { name: 'Importar', href: '/import' },
]

export default function ImportPage() {
    return (
        <main className="flex min-h-dvh flex-col bg-background">
            <Breadcrumbs crumbs={crumbs} />
            <section className="mx-auto w-full max-w-xl px-5 py-6">
                <SplitwiseImport />
            </section>
        </main>
    )
}

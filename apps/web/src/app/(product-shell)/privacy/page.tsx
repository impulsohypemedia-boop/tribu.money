import type { Metadata } from 'next'
import { Breadcrumbs } from '@/components/marketing/Breadcrumbs'
import { JsonLd } from '@/components/marketing/JsonLd'
import { SiteFooter } from '@/components/marketing/SiteFooter'
import { FEEDBACK_RETENTION_DAYS } from '@/lib/feedback-contract'
import { breadcrumbSchema, pageMetadata, pageTitle } from '@/lib/seo'
import { SOURCE_URL } from '@/lib/source'

/**
 * DRAFT. Tribu's operator, legal entity and contact are not decided yet, so this page only states
 * what the code does. It must be reviewed before launch and kept in step with `prisma/schema.prisma`,
 * `lib/analytics.ts` and the Lemon sign-in.
 */

const PATH = '/privacy'

export function generateMetadata(): Metadata {
    return pageMetadata({
        title: pageTitle('Privacidad'),
        description: 'Qué datos guarda Tribu y para qué.',
        path: PATH,
        type: 'website',
    })
}

const crumbs = [
    { name: 'Inicio', href: '/' },
    { name: 'Privacidad', href: PATH },
]

export default function PrivacyPage() {
    return (
        <main className="flex min-h-dvh flex-col bg-background" lang="es-419">
            <JsonLd data={breadcrumbSchema(crumbs)} />
            <Breadcrumbs crumbs={crumbs} />

            <header className="mt-4 border-y border-n-1 bg-primary-1">
                <div className="mx-auto w-full max-w-xl px-5 py-9">
                    <p className="text-h9 uppercase tracking-wide text-n-1">Privacidad</p>
                    <h1 className="mt-3 text-h3 leading-tight text-n-1">Qué sabe Tribu de vos</h1>
                    <p className="mt-3 text-sm text-n-1">Borrador, sujeto a revisión legal.</p>
                </div>
            </header>

            <div className="mx-auto grid w-full max-w-xl gap-6 px-5 py-10 text-base leading-7 text-n-1">
                <p>
                    Cada grupo vive en un link. Guardamos el nombre que elegís en el grupo, los gastos, los pagos y las
                    notas que cargan sus miembros. Cualquiera con el link del grupo puede verlos.
                </p>
                <p>
                    Si entrás desde Lemon, guardamos la dirección de tu wallet y, si lo aceptás, tu nombre y tu Lemon
                    tag, para que otros miembros puedan pagarte. Los pagos en cripto los ejecuta Lemon; Tribu nunca
                    tiene tus fondos ni tus claves.
                </p>
                <p>
                    Los reportes de problemas que nos mandes se borran a los {FEEDBACK_RETENTION_DAYS} días. No vendemos
                    datos ni usamos tags de publicidad.
                </p>
                <p className="text-sm leading-6 text-n-1/70">
                    Tribu es software libre bajo la licencia AGPL-3.0. El código está en{' '}
                    <a href={SOURCE_URL} target="_blank" rel="noopener noreferrer" className="underline">
                        GitHub
                    </a>
                    .
                </p>
            </div>

            <SiteFooter />
        </main>
    )
}

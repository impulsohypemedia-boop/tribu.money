import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { Breadcrumbs } from '@/components/marketing/Breadcrumbs'
import { JsonLd } from '@/components/marketing/JsonLd'
import { SiteFooter } from '@/components/marketing/SiteFooter'
import { FEEDBACK_RETENTION_DAYS } from '@/lib/feedback-contract'
import { breadcrumbSchema, pageMetadata, pageTitle } from '@/lib/seo'
import { SOURCE_URL } from '@/lib/source'

/**
 * DRAFT. Tribu's operator, legal entity and contact are not decided yet, so this page only states
 * what the code does. It must be reviewed before launch and kept in step with `prisma/schema.prisma`,
 * `lib/analytics.ts`, the Lemon sign-in and Google sign-in (`server/account`). The last paragraph is the AGPL source notice: it stays
 * while the code is AGPL.
 */

const PATH = '/terminos'
const TITLE = 'Términos y condiciones'

export function generateMetadata(): Metadata {
    return pageMetadata({
        title: pageTitle(TITLE),
        description: 'Cómo funciona Tribu, qué datos guarda y para qué.',
        path: PATH,
        type: 'website',
    })
}

const crumbs = [
    { name: 'Inicio', href: '/' },
    { name: TITLE, href: PATH },
]

function Section({ title, children }: { title: string; children: ReactNode }) {
    return (
        <section className="grid gap-2">
            <h2 className="font-display text-lg text-n-1">{title}</h2>
            {children}
        </section>
    )
}

export default function TermsPage() {
    return (
        <main className="flex min-h-dvh flex-col bg-background" lang="es-419">
            <JsonLd data={breadcrumbSchema(crumbs)} />
            <Breadcrumbs crumbs={crumbs} />

            <header className="mt-4 border-y border-n-1 bg-primary-1">
                <div className="mx-auto w-full max-w-xl px-5 py-9">
                    <h1 className="text-h3 leading-tight text-n-1">{TITLE}</h1>
                    <p className="mt-3 text-sm text-n-1">Borrador, sujeto a revisión legal.</p>
                </div>
            </header>

            <div className="mx-auto grid w-full max-w-xl gap-8 px-5 py-10 text-base leading-7 text-n-1">
                <Section title="Cómo funciona">
                    <p>
                        Cada tribu vive en un link. Cualquiera con el link puede entrar, ver los gastos y sumar los
                        suyos, así que compartilo solo con tu grupo. Tribu es gratis y no pide registro. Si querés,
                        podés entrar con Google para tener tus tribus en cualquier celular.
                    </p>
                </Section>

                <Section title="Pagos">
                    <p>
                        Tribu calcula quién le debe a quién. Los pagos en cripto los ejecuta Lemon: Tribu nunca tiene
                        tus fondos ni tus claves, y no puede revertir un pago ya enviado.
                    </p>
                </Section>

                <Section title="Tus datos">
                    <p>
                        Guardamos el nombre que elegís en cada tribu, los gastos, los pagos y las notas que cargan sus
                        miembros. Si entrás desde Lemon, guardamos la dirección de tu wallet y, si lo aceptás, tu nombre
                        y tu Lemon tag, para que otros miembros puedan pagarte.
                    </p>
                    <p>
                        Si entrás con Google, guardamos tu email para reconocer tu cuenta y en qué tribus estás. Google
                        no nos da tu contraseña. Cerrar sesión borra la sesión de ese celular.
                    </p>
                    <p>
                        Los reportes de problemas que nos mandes se borran a los {FEEDBACK_RETENTION_DAYS} días. No
                        vendemos datos ni usamos tags de publicidad.
                    </p>
                </Section>

                <p className="text-xs leading-5 text-n-1/50">
                    Parte del código de Tribu se distribuye bajo la licencia AGPL-3.0 y se puede consultar{' '}
                    <a href={SOURCE_URL} target="_blank" rel="noopener noreferrer" className="underline">
                        acá
                    </a>
                    .
                </p>
            </div>

            <SiteFooter />
        </main>
    )
}

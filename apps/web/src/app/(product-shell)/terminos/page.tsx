import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { Breadcrumbs } from '@/components/marketing/Breadcrumbs'
import { JsonLd } from '@/components/marketing/JsonLd'
import { SiteFooter } from '@/components/marketing/SiteFooter'
import { FEEDBACK_RETENTION_DAYS } from '@/lib/feedback-contract'
import { breadcrumbSchema, pageMetadata, pageTitle } from '@/lib/seo'

/**
 * DRAFT. Tribu's operator, legal entity and contact are not decided yet, so this page only states
 * what the code does. It must be reviewed before launch and kept in step with `prisma/schema.prisma`,
 * `lib/analytics.ts`, the Lemon sign-in and Google sign-in (`server/account`).
 */

const PATH = '/terminos'
const TITLE = 'Términos y condiciones'

export function generateMetadata(): Metadata {
    return pageMetadata({
        title: pageTitle(TITLE),
        description: 'Las reglas para usar Tribu y qué datos guarda.',
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
                    <p className="mt-3 text-sm text-n-1">Última actualización: 26 de noviembre de 2026</p>
                </div>
            </header>

            <div className="mx-auto grid w-full max-w-xl gap-8 px-5 py-10 text-base leading-7 text-n-1">
                <Section title="1. Aceptación">
                    <p>Al usar Tribu aceptás estos términos. Si no estás de acuerdo con ellos, no uses el servicio.</p>
                </Section>

                <Section title="2. El servicio">
                    <p>
                        Tribu es una app gratuita para anotar y dividir gastos en grupo. Cada tribu vive en un link:
                        cualquiera que lo tenga puede entrar, ver los gastos y cargar los suyos, así que compartilo solo
                        con tu grupo.
                    </p>
                    <p>
                        Te comprometés a usar Tribu de buena fe, a no cargar información falsa o de terceros sin su
                        permiso y a no intentar dañar el servicio.
                    </p>
                </Section>

                <Section title="3. Tu cuenta">
                    <p>
                        No hace falta registrarse. Si querés tener tus tribus en cualquier celular, podés entrar con
                        Google. Sos responsable de lo que se haga desde tu cuenta y tus dispositivos.
                    </p>
                </Section>

                <Section title="4. Pagos entre miembros">
                    <p>
                        Tribu calcula quién le tiene que pasar plata a quién, pero los pagos se hacen entre ustedes, con
                        el medio que elijan. Tribu nunca tiene tus fondos ni tus claves y no puede revertir un pago ya
                        enviado.
                    </p>
                </Section>

                <Section title="5. Datos personales">
                    <p>
                        Guardamos lo necesario para que Tribu funcione: el nombre que elegís en cada tribu y los gastos,
                        pagos y notas que cargan sus miembros. Si entrás con Google, guardamos tu email para reconocer
                        tu cuenta; Google no nos da tu contraseña. Si conectás una billetera, guardamos su dirección
                        para que otros miembros puedan pagarte.
                    </p>
                    <p>
                        Los reportes de problemas se borran a los {FEEDBACK_RETENTION_DAYS} días. No vendemos tus datos
                        ni usamos publicidad.
                    </p>
                </Section>

                <Section title="6. Responsabilidad">
                    <p>
                        Tribu se ofrece tal como está. Hacemos lo posible para que funcione bien y los números den, pero
                        no respondemos por acuerdos, deudas o pagos entre los miembros de una tribu.
                    </p>
                </Section>

                <Section title="7. Cambios">
                    <p>
                        Podemos actualizar estos términos. Si el cambio es importante, lo vas a ver en la app antes de
                        que aplique.
                    </p>
                </Section>

                <Section title="8. Contacto">
                    <p>Para cualquier consulta, escribinos desde “Reportar un problema” dentro de la app.</p>
                </Section>
            </div>

            <SiteFooter />
        </main>
    )
}

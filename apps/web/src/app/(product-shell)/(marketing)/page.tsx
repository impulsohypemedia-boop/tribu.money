import { HowItWorks } from '@/components/marketing/HowItWorks'
import { SiteFooter } from '@/components/marketing/SiteFooter'
import { TribuHero } from '@/components/marketing/TribuHero'
import { YourRooms } from '@/components/marketing/YourRooms'
import { StandaloneLandingRedirect } from '@/components/pwa/StandaloneLandingRedirect'
import enMessages from '@/i18n/messages/en.json'
import { pageMetadata } from '@/lib/seo'

/**
 * Head copy stays English in every locale, on purpose. The title and description are what is
 * indexed and what the OG image (also English — its fonts have no accented glyphs) already
 * says; serving a translated `og:description` beside an English card is worse than serving one
 * language consistently. Read from the English catalog rather than re-typed, so the page and
 * its own unfurl cannot drift apart.
 */
const heroSubtitle = enMessages.marketing.hero.subtitle

export const metadata = pageMetadata({
    title: 'Tribu: gastos compartidos con tu gente',
    description: heroSubtitle,
    path: '/',
    type: 'website',
})

export default function LandingPage() {
    return (
        <main data-testid="marketing-home" className="flex min-h-dvh flex-col bg-background">
            <StandaloneLandingRedirect />
            <TribuHero />
            <YourRooms surface="landing" />
            <HowItWorks />
            <SiteFooter />
        </main>
    )
}

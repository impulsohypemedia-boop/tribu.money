import { SiteFooter } from '@/components/marketing/SiteFooter'
import { StartTribu } from '@/components/marketing/StartTribu'
import { TribuFeatures } from '@/components/marketing/TribuFeatures'
import { TribuHero } from '@/components/marketing/TribuHero'
import { WhatsNext } from '@/components/marketing/WhatsNext'
import { YourRooms } from '@/components/marketing/YourRooms'
import { StandaloneLandingRedirect } from '@/components/pwa/StandaloneLandingRedirect'
import messages from '@/i18n/messages/es-419.json'
import { pageMetadata } from '@/lib/seo'

/** Tribu is Spanish only, so the page's title and description come from the Spanish catalog. */
export const metadata = pageMetadata({
    title: 'Tribu: la cuenta compartida de tu grupo',
    description: messages.marketing.hero.subtitle,
    path: '/',
    type: 'website',
})

export default function LandingPage() {
    return (
        <main data-testid="marketing-home" className="flex min-h-dvh flex-col bg-background">
            <StandaloneLandingRedirect />
            <TribuHero />
            <TribuFeatures />
            <StartTribu />
            <YourRooms surface="landing" />
            <WhatsNext />
            <SiteFooter />
        </main>
    )
}

import { LandingLink } from '@/components/pwa/LandingLink'
import { AppShellPage } from './AppTabBar'

/** The frame every top-level tab shares: an orange title bar, the content, and the menu. */
export function AppScreen({ title, testId, children }: { title: string; testId: string; children: React.ReactNode }) {
    return (
        <main data-testid={testId} className="split-app-frame mx-auto min-h-dvh w-full max-w-xl bg-background">
            <AppShellPage>
                <header className="flex items-center justify-between gap-3 border-b border-n-1 bg-primary-1 px-5 pb-5 pt-[max(1.5rem,env(safe-area-inset-top))]">
                    <h1 className="text-h4">{title}</h1>
                    <LandingLink />
                </header>
                {children}
            </AppShellPage>
        </main>
    )
}

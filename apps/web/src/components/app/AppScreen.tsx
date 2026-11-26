import { LandingLink } from '@/components/pwa/LandingLink'
import { AppShellPage } from './AppTabBar'

/** The frame every top-level tab shares: a title bar with the ronda (which leads to the landing), the content, and the menu. */
export function AppScreen({ title, testId, children }: { title: string; testId: string; children: React.ReactNode }) {
    return (
        <main data-testid={testId} className="split-app-frame mx-auto min-h-dvh w-full max-w-xl bg-background">
            <AppShellPage>
                <header className="flex items-center gap-1.5 px-4 pb-1 pt-[max(1.25rem,env(safe-area-inset-top))]">
                    <LandingLink />
                    <h1 className="font-display text-[1.8rem] leading-none">{title}</h1>
                </header>
                {children}
            </AppShellPage>
        </main>
    )
}

import { LandingLink } from '@/components/pwa/LandingLink'
import { TribuSymbol } from '@/components/ui/TribuLogo'
import { AppShellPage } from './AppTabBar'

/** The frame every top-level tab shares: a title bar with the ronda, the content, and the menu. */
export function AppScreen({ title, testId, children }: { title: string; testId: string; children: React.ReactNode }) {
    return (
        <main data-testid={testId} className="split-app-frame mx-auto min-h-dvh w-full max-w-xl bg-background">
            <AppShellPage>
                <header className="flex items-center justify-between gap-3 px-5 pb-1 pt-[max(1.25rem,env(safe-area-inset-top))]">
                    <h1 className="flex items-center gap-2.5 font-display text-[1.75rem] font-extrabold leading-none tracking-[-0.04em]">
                        <TribuSymbol size={30} />
                        {title}
                    </h1>
                    <LandingLink />
                </header>
                {children}
            </AppShellPage>
        </main>
    )
}

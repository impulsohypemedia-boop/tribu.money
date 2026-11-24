import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { AppScreen } from '@/components/app/AppScreen'
import { HomeScreen } from '@/components/app/HomeScreen'
import { CanonicalAppLaunchMarker } from '@/components/pwa/CanonicalAppLaunchMarker'
import { InstallAppSurface } from '@/components/pwa/InstallAppSurface'
import { RecentRoomAppEntry } from '@/components/pwa/RecentRoomAppEntry'
import { installSurfaceSource, isInstallRepairRequest } from '@/lib/install-surface'

export const metadata: Metadata = {
    title: 'Tribu',
    description: 'Cómo estás con todas tus tribus y vaquitas.',
    alternates: { canonical: '/app' },
    robots: { index: false, follow: true },
}

/** The accountless operational home: actions and device-local rooms, with no marketing journey. */
export default async function AppHomePage({
    searchParams,
}: {
    searchParams: Promise<{
        add?: string | string[]
        manage?: string | string[]
        install?: string | string[]
        repair?: string | string[]
        source?: string | string[]
    }>
}) {
    const tShell = await getTranslations('appShell')
    const { add, manage, install, repair, source } = await searchParams
    const addExpense = add === '1'

    const home = (
        <AppScreen title={tShell('nav.home')} testId="app-home">
            <HomeScreen />
        </AppScreen>
    )

    const repairing = isInstallRepairRequest(repair)
    if (install === '1') {
        return (
            <>
                {!repairing && <CanonicalAppLaunchMarker />}
                <main
                    data-testid="app-install"
                    className="split-app-frame mx-auto min-h-dvh w-full max-w-xl bg-background"
                >
                    <header className="border-b border-n-1 bg-primary-1 px-5 pb-5 pt-[max(1.5rem,env(safe-area-inset-top))]">
                        <h1 className="text-h4">Tribu</h1>
                    </header>
                    <InstallAppSurface source={installSurfaceSource(source)} repair={repairing} />
                </main>
            </>
        )
    }
    return (
        <>
            <CanonicalAppLaunchMarker />
            {/* The home-screen shortcut "add an expense" still jumps into the last tribu. */}
            {addExpense && manage !== '1' ? <RecentRoomAppEntry addExpense>{home}</RecentRoomAppEntry> : home}
        </>
    )
}

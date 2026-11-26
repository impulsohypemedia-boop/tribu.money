/**
 * next-intl's per-request configuration, wired WITHOUT its routing middleware.
 *
 * The app has no `[locale]` URL segment: a room link is the product, and a link that carries a
 * language is a link that arrives in the wrong one when it is forwarded. So the locale is a
 * cookie, resolved here, on the server, before anything renders — which is also what keeps the
 * first paint from flashing English at a Spanish reader.
 *
 * The **indexed** pages are the exception. A guide at `/es-419/blog/…` is a distinct URL that exists
 * so a crawler can find the Spanish version; serving it in whatever language a cookie happens to
 * hold would defeat the point and would render Spanish chrome around an English article. When the
 * URL states a language, the URL wins — and because the whole shell reads its strings through this
 * config, the footer and everything else follow with no prop-drilling.
 *
 * The URL — or an explicit `/new?locale=…` handoff — arrives as a header set by `proxy.ts`.
 * `setRequestLocale` cannot do it: this config is resolved by the root layout, which renders
 * before any page could call it. `localeFromPathname` is the rule the proxy applies to content,
 * and it answers for the unprefixed pages too: `/blog` and
 * `/tricount-alternative` are the canonical ENGLISH URLs of those pages and state `en` as firmly
 * as `/es-419/blog` states `es-419`. Only the app shell — `/`, `/new`, `/r/*` — states nothing in
 * its path; absent the explicit `/new` handoff, it is the only thing the cookie still decides.
 *
 * `requestLocale` comes first and is NOT optional to honour. next-intl re-invokes this config with
 * it whenever a caller asks for a specific language — `getTranslations({ locale: 'en' })`. Ignoring
 * it meant an explicit English lookup came back in whatever the cookie held, which served a
 * Spanish `<h1>` at the canonical English URL to anyone carrying a Spanish cookie.
 *
 * Tribu is Spanish-only for now: an explicit request (an English OG lookup) still wins, and
 * every other request renders in `es-419` whatever its cookie or browser says.
 */

import { getRequestConfig } from 'next-intl/server'
import { isLocale, type Locale } from './locales'
import { loadMessages } from './messages'

/** Tribu ships in Spanish only for now; the other catalogs stay in the repo for later. */
const PRODUCT_LOCALE: Locale = 'es-419'

async function resolveLocale(requested: string | undefined): Promise<Locale> {
    // A caller naming the language it wants. Always wins — see the note above.
    if (isLocale(requested)) return requested
    return PRODUCT_LOCALE
}

export default getRequestConfig(async ({ requestLocale }) => {
    const locale = await resolveLocale(await requestLocale)
    return {
        locale,
        // One catalog. next-intl does not preload a fallback and neither do we.
        messages: await loadMessages(locale),
        /**
         * There is deliberately no English fallback catalog here: merging one in would mean
         * loading two catalogs on every non-English request, which is exactly the regression the
         * lazy loader exists to avoid. A key missing from `es-419` therefore renders as its own key
         * path — which looks fine in dev and ships silently, so `pnpm i18n:audit` is the real
         * gate and runs in CI. This hook only stops one bad key from filling production logs.
         */
        onError: (error) => {
            if (process.env.NODE_ENV === 'development') console.warn('[split] i18n', error.message)
        },
    }
})

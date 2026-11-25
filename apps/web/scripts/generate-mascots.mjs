/**
 * Draws Tribu's cast (La Ronda) and writes the five mascot files the app imports, plus the
 * data URI the share-card rasterizer needs.
 *
 *   node scripts/generate-mascots.mjs        (or: pnpm mascots)
 *
 * Each character is a group role around shared money. Flat fills, thick ink outline, so they
 * hold up at avatar size. Deterministic: re-running produces byte-identical files.
 *
 *   hola      Tita, la que organiza (waving, clipboard)
 *   festejo   Paco, el que siempre paga (both arms up)
 *   pensando  Olvi, la que se olvida (scratching her head)
 *   triste    Fede, el que pide fiado (sheepish, sweat drop)
 *   senalando Ruli, la que divide al centavo (pointing, receipt)
 */
import { writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(fileURLToPath(new URL('..', import.meta.url)))
const OUT = path.join(root, 'src/assets/mascot')
const OG = path.join(root, 'src/server/og/mascot.ts')

const K = '#141414'
const C = {
    rosa: '#FF7AC6',
    lima: '#B9D43A',
    sol: '#FFD23F',
    pileta: '#14B8B0',
    uva: '#6E5BFF',
    mandarina: '#FF9F1C',
}

const S = (d, f, sw = 4) =>
    `<path d="${d}" fill="${f}" stroke="${K}" stroke-width="${sw}" stroke-linejoin="round" stroke-linecap="round"/>`
const limb = (d, c) =>
    `<path d="${d}" fill="none" stroke="${K}" stroke-width="16" stroke-linecap="round" stroke-linejoin="round"/>` +
    `<path d="${d}" fill="none" stroke="${c}" stroke-width="8.5" stroke-linecap="round" stroke-linejoin="round"/>`
const hand = (x, y, c, r = 9) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${c}" stroke="${K}" stroke-width="3.5"/>`
const eye = (x, y, r, dx, dy) =>
    `<ellipse cx="${x}" cy="${y}" rx="${r}" ry="${+(r * 1.12).toFixed(2)}" fill="#fff" stroke="${K}" stroke-width="3.5"/>` +
    `<circle cx="${x + dx}" cy="${y + dy}" r="${+(r * 0.42).toFixed(2)}" fill="${K}"/>` +
    `<circle cx="${+(x + dx + r * 0.14).toFixed(2)}" cy="${+(y + dy - r * 0.18).toFixed(2)}" r="${+(r * 0.12).toFixed(2)}" fill="#fff"/>`
const base = (c) =>
    `<ellipse cx="100" cy="226" rx="60" ry="7" fill="${K}"/>` +
    limb('M84 196 L84 216', c) +
    limb('M116 196 L116 216', c) +
    `<ellipse cx="79" cy="220" rx="12" ry="6" fill="${K}"/><ellipse cx="121" cy="220" rx="12" ry="6" fill="${K}"/>`
const EGG = 'M100 40 C150 40 165 110 165 150 C165 195 135 210 100 210 C65 210 35 195 35 150 C35 110 50 40 100 40Z'
const BEAN = 'M100 40 C142 40 152 75 152 125 C152 182 146 210 100 210 C54 210 48 182 48 125 C48 75 58 40 100 40Z'
const SQ =
    'M60 50 C80 42 120 42 140 50 C158 58 162 90 162 140 C162 190 150 210 100 210 C50 210 38 190 38 140 C38 90 42 58 60 50Z'
const PEAR =
    'M100 50 C128 50 138 88 144 118 C152 148 166 168 160 188 C155 206 130 210 100 210 C70 210 45 206 40 188 C34 168 48 148 56 118 C62 88 72 50 100 50Z'

const confetti =
    `<rect x="14" y="40" width="10" height="10" rx="2" fill="${C.rosa}" stroke="${K}" stroke-width="2.5" transform="rotate(20 19 45)"/>` +
    `<rect x="182" y="30" width="10" height="10" rx="2" fill="${C.lima}" stroke="${K}" stroke-width="2.5" transform="rotate(-15 187 35)"/>` +
    `<circle cx="30" cy="16" r="5" fill="${C.uva}" stroke="${K}" stroke-width="2.5"/>` +
    `<circle cx="176" cy="8" r="5" fill="${C.mandarina}" stroke="${K}" stroke-width="2.5"/>`

const CAST = {
    // Paco, el que siempre paga: celebrating, both arms up.
    festejo: () => {
        const c = C.pileta
        return (
            base(c) +
            confetti +
            S(EGG, c) +
            S(
                'M60 80 C56 48 78 30 100 30 C122 30 144 48 140 80 Q133 92 126 80 Q119 94 112 80 Q105 92 98 80 Q91 94 84 80 Q77 92 70 80 Q64 90 60 80Z',
                C.sol
            ) +
            S('M72 116 Q84 104 96 116', 'none', 4.5) +
            S('M106 116 Q118 104 130 116', 'none', 4.5) +
            S('M76 140 Q100 174 126 140 Q100 150 76 140Z', K) +
            S('M92 156 Q101 149 111 156 Q101 164 92 156Z', C.rosa, 2.5) +
            limb('M42 136 Q20 112 26 82', c) +
            hand(26, 78, c) +
            limb('M158 136 Q180 112 176 82', c) +
            hand(176, 78, c)
        )
    },
    // Olvi, la que se olvida.
    pensando: () => {
        const c = C.rosa
        const curls = [
            [54, 80, 12],
            [60, 62, 15],
            [77, 47, 17],
            [99, 39, 18],
            [121, 45, 17],
            [140, 59, 15],
            [148, 78, 12],
        ]
        return (
            base(c) +
            limb('M52 132 Q32 160 42 186', c) +
            hand(42, 188, c) +
            S(BEAN, c) +
            curls
                .map(
                    ([x, y, r]) =>
                        `<circle cx="${x}" cy="${y}" r="${r}" fill="${C.uva}" stroke="${K}" stroke-width="4"/>`
                )
                .join('') +
            `<g transform="rotate(14 136 24)">${S('M120 8 h32 v32 h-32z', C.sol, 3.5)}${S('M126 18 h20 M126 26 h14', 'none', 2.5)}</g>` +
            eye(84, 112, 12, -3, -5) +
            eye(117, 110, 14, -3, -6) +
            S('M86 154 Q93 147 100 154 Q107 161 114 154', 'none', 4) +
            limb('M148 124 Q176 106 160 82', c) +
            hand(158, 80, c) +
            S('M18 58 C18 44 40 44 40 56 C40 66 30 66 30 76 M30 86 V87', 'none', 5)
        )
    },
    // Tita, la que organiza: waving with her clipboard.
    hola: () => {
        const c = C.uva
        return (
            base(c) +
            S(SQ, c) +
            S(
                'M48 88 C42 46 80 30 108 34 C142 38 160 58 154 92 C142 68 112 60 92 70 C78 76 62 86 48 88Z',
                C.mandarina
            ) +
            `<circle cx="82" cy="114" r="16" fill="#fff" stroke="${K}" stroke-width="4"/><circle cx="120" cy="114" r="16" fill="#fff" stroke="${K}" stroke-width="4"/>` +
            S('M98 114 L104 114', 'none', 4) +
            `<circle cx="85" cy="116" r="6" fill="${K}"/><circle cx="123" cy="116" r="6" fill="${K}"/>` +
            S('M84 146 Q100 162 118 144', 'none', 4) +
            `<g transform="rotate(-8 28 156)">${S('M8 130 h42 a4 4 0 0 1 4 4 v46 a4 4 0 0 1 -4 4 h-42 a4 4 0 0 1 -4 -4 v-46 a4 4 0 0 1 4 -4z', '#fff', 3.5)}${S('M20 124 h18 v10 h-18z', C.pileta, 3)}${S('M13 146 l4 4 l7 -8 M28 148 h18 M13 162 l4 4 l7 -8 M28 164 h18 M14 178 h4 M28 178 h14', 'none', 2.5)}</g>` +
            limb('M44 150 Q34 158 40 166', c) +
            hand(40, 166, c) +
            limb('M158 136 Q186 116 184 86', c) +
            hand(184, 82, c, 10) +
            S('M170 62 L164 54 M184 58 V48 M198 62 L204 54', 'none', 3.5)
        )
    },
    // Fede, el que pide fiado.
    triste: () => {
        const c = C.mandarina
        return (
            base(c) +
            limb('M62 118 Q34 100 58 74', c) +
            hand(60, 72, c) +
            S(PEAR, c) +
            S('M90 58 C78 30 104 14 116 28 C126 18 144 32 132 46 C124 56 104 60 90 58Z', C.rosa) +
            eye(86, 112, 13, 6, 3) +
            eye(118, 112, 13, 6, 3) +
            S('M72 112 C73 97 99 97 100 112Z', c, 3.5) +
            S('M104 112 C105 97 131 97 132 112Z', c, 3.5) +
            S('M148 84 C141 95 142 104 149 104 C156 104 157 95 148 84Z', C.pileta, 3) +
            S('M88 150 Q100 141 116 152', 'none', 4) +
            limb('M150 150 Q170 156 186 144', c) +
            hand(188, 141, c, 10)
        )
    },
    // Ruli, la que divide al centavo: pointing, receipt in hand.
    senalando: () => {
        const c = C.sol
        return (
            base(c) +
            `<ellipse cx="44" cy="74" rx="13" ry="22" transform="rotate(-25 44 74)" fill="${C.lima}" stroke="${K}" stroke-width="4"/>` +
            `<ellipse cx="156" cy="74" rx="13" ry="22" transform="rotate(25 156 74)" fill="${C.lima}" stroke="${K}" stroke-width="4"/>` +
            limb('M44 140 Q22 132 22 108', c) +
            hand(22, 104, c) +
            S(EGG, c) +
            S('M58 82 C56 40 144 40 142 82 C124 64 76 64 58 82Z', C.lima) +
            `<circle cx="58" cy="66" r="6" fill="${C.rosa}" stroke="${K}" stroke-width="3"/><circle cx="142" cy="66" r="6" fill="${C.rosa}" stroke="${K}" stroke-width="3"/>` +
            eye(84, 114, 12, 2, 2) +
            eye(116, 114, 12, 2, 2) +
            S('M72 96 L95 100', 'none', 4) +
            S('M128 96 L105 100', 'none', 4) +
            S('M88 148 Q102 152 114 143', 'none', 4) +
            `<g transform="rotate(8 176 92)">${S('M160 68 L192 68 L192 116 L186 111 L180 116 L174 111 L168 116 L160 112Z', '#fff', 3.5)}${S('M166 78 h20 M166 86 h14 M166 94 h20 M166 102 h10', 'none', 2.5)}</g>` +
            limb('M158 142 Q180 138 178 118', c) +
            hand(178, 116, c)
        )
    },
}

const NAMES = {
    festejo: 'Paco festeja',
    pensando: 'Olvi pensando',
    hola: 'Tita saluda',
    triste: 'Fede, apenado',
    senalando: 'Ruli señala',
}

const file = (key) =>
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-4 0 214 236" role="img" aria-label="${NAMES[key]}">\n${CAST[key]()}\n</svg>\n`

for (const key of Object.keys(CAST)) {
    await writeFile(path.join(OUT, `tribu-${key}.svg`), file(key))
    console.log(`tribu-${key}.svg`)
}

const uri = Buffer.from(file('festejo')).toString('base64')
await writeFile(
    OG,
    `/**
 * The celebrating mascot, inlined for the image rasterizer.
 *
 * Satori draws an <img> only from a URL it can fetch or a data URI, and a serverless function
 * cannot count on reading \`src/assets\` from disk. This is \`src/assets/mascot/tribu-festejo.svg\`
 * as a data URI, written by \`scripts/generate-mascots.mjs\`.
 */
export const MASCOT_FESTEJO_URI =
    'data:image/svg+xml;base64,${uri}'
`
)
console.log('server/og/mascot.ts')

import { Fredoka, Nunito } from 'next/font/google'

const nunito = Nunito({
    subsets: ['latin'],
    display: 'swap',
    variable: '--font-nunito',
})

const fredoka = Fredoka({
    weight: ['400', '600', '700'],
    subsets: ['latin'],
    display: 'swap',
    variable: '--font-fredoka',
})

export const bodyFontClassName = `${nunito.variable} ${fredoka.variable} font-sans`

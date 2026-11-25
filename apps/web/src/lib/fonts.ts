import { Bricolage_Grotesque, Manrope } from 'next/font/google'

const manrope = Manrope({
    subsets: ['latin'],
    display: 'swap',
    variable: '--font-manrope',
})

const bricolage = Bricolage_Grotesque({
    weight: ['500', '700', '800'],
    subsets: ['latin'],
    display: 'swap',
    variable: '--font-bricolage',
})

export const bodyFontClassName = `${manrope.variable} ${bricolage.variable} font-sans`

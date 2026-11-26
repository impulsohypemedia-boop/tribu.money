import { DM_Sans, Titan_One } from 'next/font/google'

// Body and numbers: DM Sans reads clearly at small sizes and keeps amounts tidy.
const dmSans = DM_Sans({
    subsets: ['latin'],
    display: 'swap',
    variable: '--font-body',
})

// Logo and headings: Titan One, the heavy rounded face of the ronda identity. It ships one
// weight; globals.css turns off synthetic bold so `font-bold` never smears it.
const titanOne = Titan_One({
    weight: '400',
    subsets: ['latin'],
    display: 'swap',
    variable: '--font-display',
})

export const bodyFontClassName = `${dmSans.variable} ${titanOne.variable} font-sans`

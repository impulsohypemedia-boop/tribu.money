/**
 * The stories card: a tall 1080×1920 image to post when a trip or a vaquita wraps up.
 *
 * It reuses the recap's numbers and font-safety rules (`recapCard.ts`) and adds the vaquita's
 * own: what went in, against the goal. Like every other card it is shared as a file, so the room
 * link, which is the room's credential, never leaves the group; the image prints the domain.
 *
 * Satori rules, as in `recapCardArt.tsx`: explicit `display: flex` on any element with more than
 * one child, margins instead of `gap`, inline styles only, text alone in its leaf.
 */
import { ImageResponse } from 'next/og'
import { getTranslator, type Translator } from '@/i18n/t'
import { roomEmblemValue } from '@/lib/room-emblem'
import { prisma } from '@/server/db'
import { emblemDataUri, doodleDataUri } from '@/server/og/emblem'
import { DISPLAY_FONT, headlineFont, headlineWeight, ogFonts } from '@/server/og/fonts'
import { cardDomain, ConfettiScatter, INK, MUTED, OG_CACHE_CONTROL, PersonaDisc } from '@/server/og/frame'
import { MASCOT_FESTEJO_URI } from '@/server/og/mascot'
import { loadRecap, recapStatLine, type RoomRecap } from '@/server/og/recapCard'
import { bodySafe, headlineSafe, MAX_AVATARS, safeAmount, sanitizeDisplayName } from '@/server/og/roomCard'

export const STORY_SIZE = { width: 1080, height: 1920 } as const

const ORANGE = '#FF7A45'
const CREAM = '#FFF6F0'
const PEACH = '#FFE9DF'
const GREEN = '#98E9AB'

export interface StoryPot {
    contributedMinor: bigint
    targetMinor: bigint | null
    contributors: number
    closed: boolean
}

export interface StoryCardData {
    kind: 'tribu' | 'vaquita'
    name: string
    emblem: string
    headline: string
    amount: string
    amountCaption: string
    detail: string
    /** 0–100 for a vaquita with a goal; null otherwise. */
    progressPct: number | null
    personas: { avatar: string | null; palette: string | null }[]
    overflow: number
}

/** Pure: the drawable strings for one room. Exported for tests. */
export function toStoryCard(recap: RoomRecap, kind: 'tribu' | 'vaquita', pot: StoryPot | null, t: Translator) {
    const personas = recap.members.slice(0, MAX_AVATARS).map((member) => ({
        avatar: member.avatar,
        palette: member.avatarPalette,
    }))
    const base = {
        name: sanitizeDisplayName(recap.name),
        emblem: roomEmblemValue(recap.emoji, recap.name),
        personas,
        overflow: Math.max(0, recap.members.length - MAX_AVATARS),
    }

    if (kind === 'vaquita' && pot) {
        const reached = pot.targetMinor !== null && pot.contributedMinor >= pot.targetMinor
        const progressPct =
            pot.targetMinor === null || pot.targetMinor === 0n
                ? null
                : Number(((reached ? pot.targetMinor : pot.contributedMinor) * 100n) / pot.targetMinor)
        return {
            ...base,
            kind,
            headline: headlineSafe(
                t(
                    reached
                        ? 'room.storyCard.potReached'
                        : pot.closed
                          ? 'room.storyCard.potClosed'
                          : 'room.storyCard.potGoing'
                )
            ),
            amount: safeAmount(pot.contributedMinor, recap.currency),
            amountCaption: bodySafe(t('room.storyCard.potCaption', { count: pot.contributors })),
            detail:
                pot.targetMinor === null
                    ? ''
                    : bodySafe(t('room.storyCard.potGoal', { amount: safeAmount(pot.targetMinor, recap.currency) })),
            progressPct,
        } satisfies StoryCardData
    }

    return {
        ...base,
        kind: 'tribu',
        headline: headlineSafe(t(recap.settled ? 'room.storyCard.tripSettled' : 'room.storyCard.tripGoing')),
        amount: safeAmount(BigInt(recap.totalMinor), recap.currency),
        amountCaption: bodySafe(t('room.storyCard.tripCaption')),
        detail: recapStatLine(recap, t),
        progressPct: null,
    } satisfies StoryCardData
}

async function loadStory(slug: string): Promise<StoryCardData | null> {
    const [recap, room] = await Promise.all([
        loadRecap(slug),
        prisma.room.findUnique({
            where: { slug },
            select: {
                kind: true,
                pots: {
                    orderBy: { createdAt: 'desc' },
                    take: 1,
                    select: {
                        targetMinor: true,
                        closedAt: true,
                        contributions: { select: { memberId: true, amountMinor: true } },
                    },
                },
            },
        }),
    ])
    if (!recap || !room) return null
    const kind = room.kind === 'vaquita' ? 'vaquita' : 'tribu'
    const latest = room.pots[0]
    const pot: StoryPot | null = latest
        ? {
              contributedMinor: latest.contributions.reduce((sum, c) => sum + c.amountMinor, 0n),
              targetMinor: latest.targetMinor,
              contributors: new Set(latest.contributions.map((c) => c.memberId)).size,
              closed: latest.closedAt !== null,
          }
        : null
    return toStoryCard(recap, kind, pot, await getTranslator(recap.locale ?? 'es-419'))
}

function amountFontSize(amount: string): number {
    if (amount.length <= 8) return 168
    if (amount.length <= 11) return 136
    if (amount.length <= 15) return 108
    return 84
}

function StoryCard({ card }: { card: StoryCardData }) {
    const emblemSrc = emblemDataUri(card.emblem) ?? doodleDataUri('tribu')
    const accent = card.kind === 'vaquita' ? PEACH : GREEN
    return (
        <div
            style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                width: STORY_SIZE.width,
                height: STORY_SIZE.height,
                backgroundColor: ORANGE,
                position: 'relative',
                fontFamily: 'Roboto',
                color: INK,
            }}
        >
            <ConfettiScatter
                seed={card.name.length * 7 + 3}
                width={STORY_SIZE.width}
                height={STORY_SIZE.height}
                count={26}
            />

            <div style={{ display: 'flex', alignItems: 'center', marginTop: 150 }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                    src={emblemSrc}
                    width={92}
                    height={92}
                    alt=""
                    style={{ backgroundColor: CREAM, borderRadius: 24, border: `5px solid ${INK}`, padding: 10 }}
                />
                <div
                    style={{
                        display: 'block',
                        marginLeft: 28,
                        maxWidth: 760,
                        fontFamily: headlineFont(card.name),
                        fontWeight: headlineWeight(card.name),
                        fontSize: card.name.length <= 16 ? 68 : 52,
                        lineHeight: 1.1,
                        color: CREAM,
                        lineClamp: 2,
                    }}
                >
                    {card.name}
                </div>
            </div>

            <div
                style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    marginTop: 70,
                    width: 900,
                    padding: '70px 60px 64px 60px',
                    backgroundColor: CREAM,
                    border: `6px solid ${INK}`,
                    borderRadius: 48,
                    boxShadow: `14px 14px 0 ${INK}`,
                }}
            >
                <div
                    style={{
                        display: 'flex',
                        fontFamily: headlineFont(card.headline),
                        fontWeight: headlineWeight(card.headline),
                        fontSize: 84,
                        lineHeight: 1.05,
                        textAlign: 'center',
                    }}
                >
                    {card.headline}
                </div>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={MASCOT_FESTEJO_URI} width={390} height={420} alt="" style={{ marginTop: 36 }} />
                <div
                    style={{
                        display: 'flex',
                        marginTop: 24,
                        fontFamily: DISPLAY_FONT,
                        fontSize: amountFontSize(card.amount),
                        lineHeight: 1,
                    }}
                >
                    {card.amount}
                </div>
                <div style={{ display: 'flex', marginTop: 14, fontSize: 40, color: MUTED }}>{card.amountCaption}</div>

                {card.progressPct !== null ? (
                    <div
                        style={{
                            display: 'flex',
                            marginTop: 40,
                            width: 700,
                            height: 40,
                            borderRadius: 20,
                            border: `5px solid ${INK}`,
                            backgroundColor: '#FFFFFF',
                            overflow: 'hidden',
                        }}
                    >
                        <div
                            style={{
                                display: 'flex',
                                width: `${Math.max(card.progressPct, 4)}%`,
                                height: '100%',
                                backgroundColor: card.progressPct >= 100 ? GREEN : ORANGE,
                            }}
                        />
                    </div>
                ) : null}

                {card.detail ? (
                    <div
                        style={{
                            display: 'flex',
                            marginTop: 30,
                            padding: '14px 30px',
                            borderRadius: 999,
                            backgroundColor: accent,
                            fontSize: 36,
                        }}
                    >
                        {card.detail}
                    </div>
                ) : null}

                <div style={{ display: 'flex', alignItems: 'center', marginTop: 44 }}>
                    {card.personas.map((persona, i) => (
                        <PersonaDisc
                            key={i}
                            avatar={persona.avatar}
                            palette={persona.palette}
                            size={96}
                            marginLeft={i === 0 ? 0 : -24}
                        />
                    ))}
                    {card.overflow > 0 ? (
                        <div
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                width: 96,
                                height: 96,
                                marginLeft: -24,
                                borderRadius: 48,
                                border: `4px solid ${INK}`,
                                backgroundColor: '#FFFFFF',
                                fontSize: 36,
                                fontWeight: 800,
                            }}
                        >
                            {`+${card.overflow}`}
                        </div>
                    ) : null}
                </div>
            </div>

            <div
                style={{
                    display: 'flex',
                    position: 'absolute',
                    bottom: 120,
                    fontFamily: DISPLAY_FONT,
                    fontSize: 64,
                    color: CREAM,
                }}
            >
                {cardDomain()}
            </div>
        </div>
    )
}

/** Always 200: an unknown room gets a plain brand story rather than a dead share button. */
export async function storyImageResponse(slug: string, onLookupMiss?: () => void): Promise<ImageResponse> {
    const [fonts, lookup] = await Promise.all([
        ogFonts(),
        loadStory(slug).then(
            (card) => ({ card, missed: card === null }),
            () => ({ card: null, missed: false })
        ),
    ])
    if (lookup.missed) onLookupMiss?.()

    const card: StoryCardData = lookup.card ?? {
        kind: 'tribu',
        name: 'Tribu',
        emblem: 'tribu',
        headline: 'Tribu',
        amount: '',
        amountCaption: '',
        detail: '',
        progressPct: null,
        personas: [],
        overflow: 0,
    }
    return new ImageResponse(<StoryCard card={card} />, {
        ...STORY_SIZE,
        fonts,
        headers: { 'Cache-Control': lookup.card ? OG_CACHE_CONTROL : 'no-store' },
    })
}

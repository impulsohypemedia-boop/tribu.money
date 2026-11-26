'use client'

import { useEffect, useMemo, useState } from 'react'
import { useQueries } from '@tanstack/react-query'
import { ACCOUNT_ROOMS_EVENT } from '../account'
import { readIdentity } from '../identity'
import type { MyRoom } from '../my-overview'
import { readRecentRooms, type RecentRoom } from '../recent-rooms'
import { roomSnapshotQueryOptions } from './reads'

export interface MyRoomsResult {
    /** What this device remembers, newest first. Empty until mounted. */
    recent: RecentRoom[]
    /** Rooms whose snapshot has arrived, with this device's member id in each. */
    rooms: MyRoom[]
    /** Still waiting on at least one room. */
    loading: boolean
    /** The device has been read (false only on the server and the first client render). */
    ready: boolean
}

/**
 * Every room this device remembers, fetched once each for the app's top-level screens.
 *
 * It shares the room cache key, so opening a room after Inicio starts from what is already here.
 */
export function useMyRooms(): MyRoomsResult {
    const [recent, setRecent] = useState<RecentRoom[]>([])
    const [ready, setReady] = useState(false)
    useEffect(() => {
        setRecent(readRecentRooms())
        setReady(true)
        // Signing in on a new phone brings the account's tribus onto this device.
        const reread = () => setRecent(readRecentRooms())
        window.addEventListener(ACCOUNT_ROOMS_EVENT, reread)
        return () => window.removeEventListener(ACCOUNT_ROOMS_EVENT, reread)
    }, [])

    const results = useQueries({
        queries: recent.map((room) => ({ ...roomSnapshotQueryOptions(room.slug), staleTime: 30_000 })),
    })

    const rooms = useMemo(
        () =>
            recent.flatMap((room, index): MyRoom[] => {
                const state = results[index]?.data
                if (!state) return []
                const identity = readIdentity(room.slug)
                const meId =
                    identity && state.members.some((m) => m.id === identity.memberId) ? identity.memberId : null
                return [{ slug: room.slug, meId, state }]
            }),
        // `results` is a new array each render; its data identities are what matter.
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [recent, ...results.map((result) => result.data)]
    )

    return { recent, rooms, loading: results.some((result) => result.isPending), ready }
}

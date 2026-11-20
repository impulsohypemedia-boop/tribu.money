'use client'

import * as React from 'react'
import { cn as twMerge } from '@/lib/cn'
import { Drawer as DrawerPrimitive } from 'vaul'

/**
 * Drawers can overlap while one URL-owned sheet replaces another. Every live
 * sheet claims the background independently; the last owner restores only the
 * inert state that existed before the first claim.
 */
const inertClaims = new WeakMap<HTMLElement, { count: number; initiallyInert: boolean }>()

/**
 * A sheet is modal, so the room behind it is `inert`: nothing in it is tabbable,
 * reachable by a screen reader's own cursor, or findable.
 *
 * The dialog underneath already marks the background `aria-hidden`, which is the
 * half of modality browsers and screen readers disagree about — out of the
 * accessibility tree while every control in it stays focusable. `inert` is the
 * whole of it, so the `aria-hidden` goes with it: shipping both is exactly the
 * combination that leaves a subtree unreadable and still tabbable. The dialog
 * removes the attribute again on close and finds a no-op.
 *
 * The dialog's own marker attribute picks the elements rather than a hand-rolled
 * sweep of `document.body`: it already leaves out the live regions the toasts
 * announce through, and the sheet itself. Radix controls pointer events on a
 * direct `<main>` without consistently marking it, so include that app root
 * explicitly. The overlay is the one marked thing that has to stay live —
 * decorative to a screen reader, but it is also the backdrop, and an inert
 * backdrop cannot be tapped to close the sheet.
 *
 * This renders inside the content so it lives exactly as long as the sheet does.
 * The work waits a microtask because effects run child first: the dialog marks
 * the background in an effect of its own, which has not run yet when this one
 * does, and the marker is what we read.
 */
function InertBackground() {
    React.useEffect(() => {
        let cancelled = false
        let claimed: HTMLElement[] = []
        queueMicrotask(() => {
            if (cancelled) return
            const background = Array.from(
                document.querySelectorAll<HTMLElement>(
                    'body > [data-aria-hidden]:not([data-vaul-overlay]), body > main'
                )
            )
            claimed = background
            for (const element of background) {
                const claim = inertClaims.get(element)
                if (claim) claim.count += 1
                else {
                    inertClaims.set(element, {
                        count: 1,
                        initiallyInert: element.hasAttribute('inert'),
                    })
                }
                element.setAttribute('inert', '')
                element.removeAttribute('aria-hidden')
            }
        })
        return () => {
            cancelled = true
            for (const element of claimed) {
                const claim = inertClaims.get(element)
                if (!claim) continue
                claim.count -= 1
                if (claim.count > 0) continue
                if (!claim.initiallyInert) element.removeAttribute('inert')
                inertClaims.delete(element)
            }
        }
    }, [])
    return null
}

/**
 * Keeps an open sheet inside the part of the screen the software keyboard leaves visible.
 *
 * vaul's own `repositionInputs` snapshots a pixel height when the keyboard opens and pins the
 * sheet with it. On iOS Safari, which also scrolls the page under a fixed element when a field
 * takes focus, that left the sheet cut off at the top of the screen with the backdrop over the
 * rest, and the field being typed in hidden. Instead this follows `visualViewport`: while the
 * keyboard is up, the sheet's bottom edge sits on top of the keyboard and its height is capped to
 * what is visible, so its own body scrolls and the focused field is brought into view. With the
 * keyboard down, the inline styles go and the sheet is back to its normal layout.
 */
function useKeyboardAwareSheet(sheetRef: React.RefObject<HTMLElement | null>) {
    React.useEffect(() => {
        const viewport = window.visualViewport
        if (!viewport) return
        let frame = 0
        const update = () => {
            const sheet = sheetRef.current
            if (!sheet) return
            const covered = window.innerHeight - viewport.height
            // Browser chrome collapsing changes the height by less than a keyboard does.
            if (covered < 120) {
                sheet.style.removeProperty('bottom')
                sheet.style.removeProperty('max-height')
                return
            }
            const below = Math.max(0, window.innerHeight - (viewport.offsetTop + viewport.height))
            sheet.style.bottom = `${below}px`
            sheet.style.maxHeight = `${Math.max(160, viewport.height - 12)}px`
            const active = document.activeElement
            if (active instanceof HTMLElement && sheet.contains(active) && active.matches('input, textarea, select')) {
                active.scrollIntoView({ block: 'nearest' })
            }
        }
        const schedule = () => {
            cancelAnimationFrame(frame)
            frame = requestAnimationFrame(update)
        }
        viewport.addEventListener('resize', schedule)
        viewport.addEventListener('scroll', schedule)
        // A field focused while the keyboard is already up does not resize the viewport.
        document.addEventListener('focusin', schedule)
        schedule()
        return () => {
            cancelAnimationFrame(frame)
            viewport.removeEventListener('resize', schedule)
            viewport.removeEventListener('scroll', schedule)
            document.removeEventListener('focusin', schedule)
        }
    }, [sheetRef])
}

/**
 * `autoFocus` is vaul's, and it defaults to FALSE: it cancels the dialog's
 * open-autofocus, so focus stayed on whatever opened the sheet. The focus trap
 * only pulls focus back to the last element it saw INSIDE the dialog, so with
 * nothing ever focused in there the trap never armed either — Tab walked into
 * the room behind the sheet, and two of them opened a second sheet on top of
 * this one. Being modal is what a sheet is, not a per-caller decision.
 */
const Drawer = ({
    shouldScaleBackground = true,
    autoFocus = true,
    repositionInputs = false,
    ...props
}: React.ComponentProps<typeof DrawerPrimitive.Root>) => {
    return (
        <DrawerPrimitive.Root
            shouldScaleBackground={shouldScaleBackground}
            autoFocus={autoFocus}
            // Keyboard handling is `useKeyboardAwareSheet`'s; see there for why not vaul's.
            repositionInputs={repositionInputs}
            snapToSequentialPoint
            {...props}
        />
    )
}
Drawer.displayName = 'Drawer'

const DrawerTrigger = DrawerPrimitive.Trigger

const DrawerPortal = DrawerPrimitive.Portal

const DrawerClose = DrawerPrimitive.Close

const DrawerOverlay = React.forwardRef<
    React.ElementRef<typeof DrawerPrimitive.Overlay>,
    React.ComponentPropsWithoutRef<typeof DrawerPrimitive.Overlay>
>(({ className, ...props }, ref) => (
    <DrawerPrimitive.Overlay ref={ref} className={twMerge('fixed inset-0 z-50 bg-n-1/80', className)} {...props} />
))
DrawerOverlay.displayName = DrawerPrimitive.Overlay.displayName

const DrawerContent = React.forwardRef<
    React.ElementRef<typeof DrawerPrimitive.Content>,
    React.ComponentPropsWithoutRef<typeof DrawerPrimitive.Content>
>(({ className, children, onOpenAutoFocus, onCloseAutoFocus, onPointerDownOutside, ...props }, ref) => {
    /** No sheet here is opened by a `DrawerTrigger` — they are URL params — so the
     *  dialog's own "focus the trigger again" had no trigger to find and closing
     *  dropped focus on `<body>`. Remember what the sheet took focus from. */
    const openerRef = React.useRef<HTMLElement | null>(null)
    const sheetRef = React.useRef<HTMLDivElement | null>(null)
    useKeyboardAwareSheet(sheetRef)
    const setRefs = React.useCallback(
        (node: HTMLDivElement | null) => {
            sheetRef.current = node
            if (typeof ref === 'function') ref(node)
            else if (ref) ref.current = node
        },
        [ref]
    )

    return (
        <DrawerPortal>
            <DrawerOverlay />
            <DrawerPrimitive.Content
                ref={setRefs}
                className={twMerge(
                    // The sheet stops short of the top on purpose. That strip is the
                    // only backdrop a phone has to tap on, and it is where you watch
                    // the room repaint behind a theme change. At full height there is
                    // no "behind" and no way out but the close button.
                    'fixed inset-x-0 bottom-0 z-50 mt-6 flex max-h-[90dvh] flex-col overflow-hidden rounded-t-2xl border border-n-1 bg-background',
                    className
                )}
                aria-describedby={undefined}
                onOpenAutoFocus={(event) => {
                    openerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
                    onOpenAutoFocus?.(event)
                }}
                onCloseAutoFocus={(event) => {
                    onCloseAutoFocus?.(event)
                    // A caller with a stable semantic fallback can override the
                    // remembered opener (for example when that opener unmounted
                    // while one drawer replaced another). A replacing modal can
                    // own that handoff before generic restoration races it.
                    if (event.defaultPrevented) {
                        openerRef.current = null
                        return
                    }
                    // Ours instead of the dialog's, which would go looking for a trigger.
                    event.preventDefault()
                    if (openerRef.current?.isConnected) openerRef.current.focus()
                    openerRef.current = null
                }}
                /**
                 * A toast is not the backdrop.
                 *
                 * The dialog dismisses on any pointer down outside its own React tree, and
                 * the toast host is a sibling of the sheet rather than a child of it — so
                 * the tap that answers a toast counted as a tap to close. That toast is
                 * usually the SHEET'S OWN reply: the Undo under a person just marked Former
                 * in Settings. Answering it closed the sheet out from under the answer, and
                 * for a caller-fired toast there is no call site that could have known.
                 *
                 * The backdrop keeps every tap that is genuinely on the backdrop; sonner's
                 * toasts are the only thing carved out, and only where one is drawn.
                 * `lib/providers` owns the other half — the host is `pointer-events: auto`,
                 * or none of these taps land anywhere at all.
                 */
                onPointerDownOutside={(event) => {
                    onPointerDownOutside?.(event)
                    if (event.defaultPrevented) return
                    const target = event.detail.originalEvent.target
                    if (target instanceof Element && target.closest('[data-sonner-toast]')) {
                        event.preventDefault()
                    }
                }}
                {...props}
            >
                <InertBackground />
                <div className="mx-auto my-3 h-1.5 w-10 shrink-0 rounded-full bg-n-1" />
                <div className="flex min-h-0 w-full justify-center">
                    {/* vaul animates the sheet; this is the content settling inside it.
                        A mount-time CSS animation rather than a transition, because the
                        content is portalled in on open — there is no "before" state for
                        a transition to run from. */}
                    <div className="animate-drawer-in flex min-h-0 w-full flex-col md:max-h-[min(92dvh,52rem)] md:max-w-xl">
                        {children}
                    </div>
                </div>
            </DrawerPrimitive.Content>
        </DrawerPortal>
    )
})
DrawerContent.displayName = 'DrawerContent'

const DrawerHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
    <div className={twMerge('grid gap-1.5 px-4 pb-1 pt-4 text-left', className)} {...props} />
)
DrawerHeader.displayName = 'DrawerHeader'

const DrawerFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
    <div className={twMerge('mt-auto flex flex-col gap-2 p-4', className)} {...props} />
)
DrawerFooter.displayName = 'DrawerFooter'

const DrawerTitle = React.forwardRef<
    React.ElementRef<typeof DrawerPrimitive.Title>,
    React.ComponentPropsWithoutRef<typeof DrawerPrimitive.Title>
>(({ className, ...props }, ref) => (
    <DrawerPrimitive.Title
        ref={ref}
        className={twMerge('text-lg font-semibold leading-none tracking-tight', className)}
        {...props}
    />
))
DrawerTitle.displayName = DrawerPrimitive.Title.displayName

const DrawerDescription = React.forwardRef<
    React.ElementRef<typeof DrawerPrimitive.Description>,
    React.ComponentPropsWithoutRef<typeof DrawerPrimitive.Description>
>(({ className, ...props }, ref) => (
    <DrawerPrimitive.Description ref={ref} className={twMerge('text-sm text-grey-1', className)} {...props} />
))
DrawerDescription.displayName = DrawerPrimitive.Description.displayName

export { Drawer, DrawerTrigger, DrawerClose, DrawerContent, DrawerHeader, DrawerFooter, DrawerTitle, DrawerDescription }

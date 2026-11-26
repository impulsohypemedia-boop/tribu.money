import { expect, type Page } from '@playwright/test'
import { openDevice, test } from './fixtures'
import { enterCreatedRoom } from './helpers'

/**
 * A room no longer interrupts with a head-count card ("3 names in this ledger"): it gave friends
 * nothing worth posting. The end-of-trip award is the only in-room share moment left.
 *
 * One room is built and then reused by every test in this file: room creation is rate-limited per
 * IP, and a spec that mints one room per assertion becomes order-dependent the moment the budget
 * runs out.
 */

/** Open the room link on a fresh device and join under a new name. */
async function join(page: Page, url: string, name: string): Promise<void> {
    await page.goto(url)
    await expect(page.getByTestId('join-gate')).toBeVisible({ timeout: 15_000 })
    await page.getByTestId('im-new').click()
    await page.getByTestId('join-name').fill(name)
    await page.getByTestId('join-room').click()
    await expect(page.getByTestId('join-gate')).toHaveCount(0, { timeout: 15_000 })
}

test.describe.configure({ mode: 'serial' })

let roomUrl = ''

test.beforeAll(async ({ browser }) => {
    const page = await openDevice(browser)
    await page.goto('/new')
    await page.getByTestId('room-name').fill(`Crew trip ${Date.now()}`)
    await page.getByTestId('room-currency').selectOption('EUR')
    await page.getByTestId('creator-name').fill('Ana')
    await page.getByTestId('create-room').click()
    roomUrl = await enterCreatedRoom(page)

    // One more person. A third joins in the test, which is where the old CREW rung sat.
    const bea = await openDevice(browser)
    await join(bea, roomUrl, 'Bea')
    await page.context().close()
})

test('a three-person room with its first expense shows no head-count card', async ({ newDevice }) => {
    const page = await newDevice()
    await join(page, roomUrl, 'Caro')

    await page.getByTestId('open-add-expense').click()
    await page.getByTestId('expense-amount').fill('30')
    await page.getByTestId('expense-description').fill('First shared dinner')
    await page.getByTestId('save-expense').click()
    await expect(page.getByTestId('skip-post-aha-share')).toBeVisible({ timeout: 15_000 })
    await page.getByTestId('skip-post-aha-share').click()

    await expect(page.getByText('First shared dinner').first()).toBeVisible({ timeout: 15_000 })
    await expect(page.getByTestId('achievement-moment')).toHaveCount(0)
    await expect(page.getByTestId('share-card-crew')).toHaveCount(0)
})

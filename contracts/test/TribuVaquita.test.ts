import assert from 'node:assert/strict'
import hre from 'hardhat'
import { keccak256, stringToHex, zeroAddress, type Address, type Hex } from 'viem'

const PAY = 0
const ADD_MEMBER = 1
const REMOVE_MEMBER = 2
const SET_APPROVALS = 3
const NO_MEMO = `0x${'00'.repeat(32)}` as Hex
const usd = (dollars: number) => BigInt(Math.round(dollars * 1_000_000))
const salt = (text: string) => keccak256(stringToHex(text))

const RAY = 10n ** 27n

/** `earns` sets whether the pots `createPot` makes put their money in (test) Aave. */
async function setup({ earns = false } = {}) {
	const [ana, beto, caro, dani, stranger] = await hre.viem.getWalletClients()
	const coin = await hre.viem.deployContract('TestStablecoin')
	const other = await hre.viem.deployContract('TestStablecoin')
	const aave = await hre.viem.deployContract('TestAavePool')
	await aave.write.list([coin.address])
	const vaquita = await hre.viem.deployContract('TribuVaquita', [[coin.address], aave.address])
	for (const wallet of [ana, beto, caro, dani, stranger]) {
		await coin.write.mint([wallet.account.address, usd(1000)])
		await coin.write.approve([vaquita.address, usd(1000)], { account: wallet.account })
	}
	const as = (wallet: typeof ana) => hre.viem.getContractAt('TribuVaquita', vaquita.address, { client: { wallet } })

	/** Ana creates a pot for the given members and returns its id. */
	async function createPot(members: Address[], approvalsNeeded: bigint, name = 'casa') {
		await vaquita.write.createPot([salt(name), coin.address, earns, members, approvalsNeeded])
		return vaquita.read.potIdFor([ana.account.address, salt(name)])
	}
	const part = (potId: Hex, who: Address) => vaquita.read.partOf([potId, who])
	const total = async (potId: Hex) => (await vaquita.read.getPot([potId]))[3]
	const balance = (who: Address) => coin.read.balanceOf([who])
	/** What the contract really holds for its pots: coins for plain ones, Aave balance for earning ones. */
	const held = async () =>
		(await balance(vaquita.address)) + (await aave.read.balanceOf([coin.address, vaquita.address]))
	/** Interest: raise Aave's index by `pct` percent and fund it, as borrowers would. */
	async function earn(pct: bigint) {
		const index = await aave.read.index([coin.address])
		const supplied = await aave.read.balanceOf([coin.address, vaquita.address])
		await aave.write.setIndex([coin.address, (index * (100n + pct)) / 100n])
		await coin.write.mint([aave.address, (supplied * pct) / 100n + 1n])
	}

	return {
		ana,
		beto,
		caro,
		dani,
		stranger,
		coin,
		other,
		aave,
		vaquita,
		as,
		createPot,
		part,
		total,
		balance,
		held,
		earn,
	}
}

const reverts = (promise: Promise<unknown>, error: string) =>
	assert.rejects(promise, (thrown: Error) => {
		assert.match(thrown.message, new RegExp(error))
		return true
	})

describe('TribuVaquita', () => {
	describe('creating a pot', () => {
		it('derives the id from the creator and the salt', async () => {
			const { ana, beto, createPot, vaquita } = await setup()
			const potId = await createPot([ana.account.address, beto.account.address], 2n)
			const [, , approvals, , members] = await vaquita.read.getPot([potId])
			assert.equal(approvals, 2n)
			assert.deepEqual(
				members.map((m) => m.toLowerCase()),
				[ana.account.address, beto.account.address].map((m) => m.toLowerCase())
			)
		})

		it('refuses a token that was not allowed at deployment', async () => {
			const { ana, other, vaquita } = await setup()
			await reverts(
				vaquita.write.createPot([salt('x'), other.address, false, [ana.account.address], 1n]),
				'TokenNotAllowed'
			)
		})

		it('refuses to reuse an id', async () => {
			const { ana, createPot } = await setup()
			await createPot([ana.account.address], 1n)
			await reverts(createPot([ana.account.address], 1n), 'PotExists')
		})

		it('requires the creator to be a member, with no duplicates', async () => {
			const { ana, beto, createPot } = await setup()
			await reverts(createPot([beto.account.address], 1n), 'BadMembers')
			await reverts(createPot([ana.account.address, ana.account.address], 1n, 'dup'), 'BadMembers')
		})

		it('needs between one approval and one per member', async () => {
			const { ana, beto, createPot } = await setup()
			await reverts(createPot([ana.account.address, beto.account.address], 0n), 'BadApprovals')
			await reverts(createPot([ana.account.address, beto.account.address], 3n, 'b'), 'BadApprovals')
		})
	})

	describe('deposits and withdrawals', () => {
		it('credits the depositor and lets them take their part back without asking', async () => {
			const { ana, beto, as, createPot, part, total, balance } = await setup()
			const potId = await createPot([ana.account.address, beto.account.address], 2n)
			await (await as(beto)).write.deposit([potId, usd(40)])
			assert.equal(await part(potId, beto.account.address), usd(40))
			assert.equal(await total(potId), usd(40))

			await (await as(beto)).write.withdraw([potId, usd(15)])
			assert.equal(await part(potId, beto.account.address), usd(25))
			assert.equal(await balance(beto.account.address), usd(975))
		})

		it('does not let anyone take more than their own part', async () => {
			const { ana, beto, as, createPot } = await setup()
			const potId = await createPot([ana.account.address, beto.account.address], 1n)
			await (await as(ana)).write.deposit([potId, usd(100)])
			await (await as(beto)).write.deposit([potId, usd(1)])
			await reverts((await as(beto)).write.withdraw([potId, usd(2)]), 'BadAmount')
		})

		it('only takes deposits from members', async () => {
			const { ana, stranger, as, createPot } = await setup()
			const potId = await createPot([ana.account.address], 1n)
			await reverts((await as(stranger)).write.deposit([potId, usd(5)]), 'NotMember')
		})

		it('keeps each pot separate inside the one contract', async () => {
			const { ana, beto, as, createPot, total, vaquita, coin } = await setup()
			const casa = await createPot([ana.account.address], 1n, 'casa')
			const viaje = await createPot([ana.account.address, beto.account.address], 1n, 'viaje')
			await (await as(ana)).write.deposit([casa, usd(30)])
			await (await as(beto)).write.deposit([viaje, usd(70)])
			assert.equal(await total(casa), usd(30))
			assert.equal(await total(viaje), usd(70))
			// A stray transfer to the contract belongs to no pot.
			await coin.write.transfer([vaquita.address, usd(5)])
			assert.equal(await total(casa), usd(30))
		})
	})

	describe('paying from the pot', () => {
		it('waits for enough approvals, then pays and charges every part by its size', async () => {
			const { ana, beto, caro, dani, as, createPot, part, total, balance } = await setup()
			const potId = await createPot([ana.account.address, beto.account.address, caro.account.address], 2n)
			await (await as(ana)).write.deposit([potId, usd(60)])
			await (await as(beto)).write.deposit([potId, usd(30)])
			await (await as(caro)).write.deposit([potId, usd(10)])

			await (await as(ana)).write.propose([potId, PAY, dani.account.address, usd(50), NO_MEMO])
			assert.equal(await total(potId), usd(100), 'one approval of two is not enough')

			await (await as(beto)).write.approve([potId, 0n])
			assert.equal(await balance(dani.account.address), usd(1050))
			assert.equal(await total(potId), usd(50))
			assert.equal(await part(potId, ana.account.address), usd(30))
			assert.equal(await part(potId, beto.account.address), usd(15))
			assert.equal(await part(potId, caro.account.address), usd(5))
		})

		it('keeps the parts summing to the total when the split does not divide evenly', async () => {
			const { ana, beto, caro, dani, as, createPot, part, total } = await setup()
			const potId = await createPot([ana.account.address, beto.account.address, caro.account.address], 1n)
			for (const wallet of [ana, beto, caro]) await (await as(wallet)).write.deposit([potId, 1n])
			await (await as(ana)).write.propose([potId, PAY, dani.account.address, 2n, NO_MEMO])
			const parts = await Promise.all([ana, beto, caro].map((w) => part(potId, w.account.address)))
			assert.equal(
				parts.reduce((a, b) => a + b, 0n),
				await total(potId)
			)
			assert.equal(await total(potId), 1n)
		})

		it('never charges a member who put nothing in', async () => {
			const { ana, beto, dani, as, createPot, part } = await setup()
			const potId = await createPot([ana.account.address, beto.account.address], 1n)
			await (await as(ana)).write.deposit([potId, usd(7)])
			await (await as(ana)).write.propose([potId, PAY, dani.account.address, usd(3), NO_MEMO])
			assert.equal(await part(potId, beto.account.address), 0n)
			assert.equal(await part(potId, ana.account.address), usd(4))
		})

		it('refuses a payment larger than the pot', async () => {
			const { ana, dani, as, createPot } = await setup()
			const potId = await createPot([ana.account.address], 1n)
			await (await as(ana)).write.deposit([potId, usd(10)])
			await reverts(
				(await as(ana)).write.propose([potId, PAY, dani.account.address, usd(11), NO_MEMO]),
				'BadAmount'
			)
		})

		it('holds an approved payment the pot can no longer cover, and runs it once it can', async () => {
			const { ana, beto, dani, as, createPot, balance } = await setup()
			const potId = await createPot([ana.account.address, beto.account.address], 2n)
			await (await as(ana)).write.deposit([potId, usd(20)])
			await (await as(ana)).write.propose([potId, PAY, dani.account.address, usd(20), NO_MEMO])
			await (await as(ana)).write.withdraw([potId, usd(10)])

			await (await as(beto)).write.approve([potId, 0n])
			assert.equal(await balance(dani.account.address), usd(1000), 'not paid while short')

			await (await as(beto)).write.deposit([potId, usd(10)])
			await (await as(beto)).write.execute([potId, 0n])
			assert.equal(await balance(dani.account.address), usd(1020))
		})

		it('does not count the same approval twice or run a proposal twice', async () => {
			const { ana, beto, caro, dani, as, createPot } = await setup()
			const potId = await createPot([ana.account.address, beto.account.address, caro.account.address], 2n)
			await (await as(ana)).write.deposit([potId, usd(10)])
			await (await as(ana)).write.propose([potId, PAY, dani.account.address, usd(5), NO_MEMO])
			await reverts((await as(ana)).write.approve([potId, 0n]), 'AlreadyApproved')
			await (await as(beto)).write.approve([potId, 0n])
			await reverts((await as(caro)).write.approve([potId, 0n]), 'ProposalClosed')
			await reverts((await as(caro)).write.execute([potId, 0n]), 'ProposalClosed')
		})

		it('lets only the proposer cancel, and a cancelled proposal cannot run', async () => {
			const { ana, beto, caro, dani, as, createPot } = await setup()
			const potId = await createPot([ana.account.address, beto.account.address, caro.account.address], 2n)
			await (await as(ana)).write.deposit([potId, usd(10)])
			await (await as(ana)).write.propose([potId, PAY, dani.account.address, usd(5), NO_MEMO])
			await reverts((await as(beto)).write.cancel([potId, 0n]), 'NotProposer')
			await (await as(ana)).write.cancel([potId, 0n])
			await reverts((await as(beto)).write.approve([potId, 0n]), 'ProposalClosed')
		})

		it('does not let a stranger propose or approve', async () => {
			const { ana, beto, stranger, as, createPot } = await setup()
			const potId = await createPot([ana.account.address, beto.account.address], 2n)
			await (await as(ana)).write.deposit([potId, usd(10)])
			await reverts(
				(await as(stranger)).write.propose([potId, PAY, stranger.account.address, usd(5), NO_MEMO]),
				'NotMember'
			)
			await (await as(ana)).write.propose([potId, PAY, stranger.account.address, usd(5), NO_MEMO])
			await reverts((await as(stranger)).write.approve([potId, 0n]), 'NotMember')
		})

		it('refuses to pay the zero address or the contract itself', async () => {
			const { ana, as, createPot, vaquita } = await setup()
			const potId = await createPot([ana.account.address], 1n)
			await (await as(ana)).write.deposit([potId, usd(10)])
			await reverts((await as(ana)).write.propose([potId, PAY, zeroAddress, usd(1), NO_MEMO]), 'BadTarget')
			await reverts((await as(ana)).write.propose([potId, PAY, vaquita.address, usd(1), NO_MEMO]), 'BadTarget')
		})
	})

	describe('members', () => {
		it('adds a member once enough members approve', async () => {
			const { ana, beto, caro, as, createPot, vaquita } = await setup()
			const potId = await createPot([ana.account.address, beto.account.address], 2n)
			await (await as(ana)).write.propose([potId, ADD_MEMBER, caro.account.address, 0n, NO_MEMO])
			assert.equal(await vaquita.read.isMember([potId, caro.account.address]), false)
			await (await as(beto)).write.approve([potId, 0n])
			assert.equal(await vaquita.read.isMember([potId, caro.account.address]), true)
			await (await as(caro)).write.deposit([potId, usd(1)])
		})

		it('refunds a removed member their whole part', async () => {
			const { ana, beto, as, createPot, balance, total, vaquita } = await setup()
			const potId = await createPot([ana.account.address, beto.account.address], 1n)
			await (await as(beto)).write.deposit([potId, usd(25)])
			await (await as(ana)).write.propose([potId, REMOVE_MEMBER, beto.account.address, 0n, NO_MEMO])
			assert.equal(await vaquita.read.isMember([potId, beto.account.address]), false)
			assert.equal(await balance(beto.account.address), usd(1000))
			assert.equal(await total(potId), 0n)
		})

		it('lets a member leave with their part, but not the last one', async () => {
			const { ana, beto, as, createPot, balance } = await setup()
			const potId = await createPot([ana.account.address, beto.account.address], 2n)
			await (await as(beto)).write.deposit([potId, usd(8)])
			await (await as(beto)).write.leave([potId])
			assert.equal(await balance(beto.account.address), usd(1000))
			await reverts((await as(ana)).write.leave([potId]), 'LastMember')
		})

		it('lowers the approvals needed when the roster shrinks below it', async () => {
			const { ana, beto, as, createPot, vaquita } = await setup()
			const potId = await createPot([ana.account.address, beto.account.address], 2n)
			await (await as(beto)).write.leave([potId])
			assert.equal((await vaquita.read.getPot([potId]))[2], 1n)
		})

		it('drops the approval of a member who left, even if they come back', async () => {
			const { ana, beto, caro, dani, as, createPot, vaquita } = await setup()
			const potId = await createPot([ana.account.address, beto.account.address, caro.account.address], 3n)
			await (await as(ana)).write.deposit([potId, usd(10)])
			await (await as(beto)).write.propose([potId, PAY, dani.account.address, usd(5), NO_MEMO])
			assert.equal(await vaquita.read.approvalCount([potId, 0n]), 1n)

			await (await as(beto)).write.leave([potId]) // approvals needed drops to 2
			assert.equal(await vaquita.read.approvalCount([potId, 0n]), 0n)

			await (await as(ana)).write.propose([potId, ADD_MEMBER, beto.account.address, 0n, NO_MEMO])
			await (await as(caro)).write.approve([potId, 1n])
			assert.equal(await vaquita.read.isMember([potId, beto.account.address]), true)
			assert.equal(await vaquita.read.approvalCount([potId, 0n]), 0n)
		})

		it('changes how many approvals a payment needs', async () => {
			const { ana, beto, caro, as, createPot, vaquita } = await setup()
			const potId = await createPot([ana.account.address, beto.account.address, caro.account.address], 1n)
			await (await as(ana)).write.propose([potId, SET_APPROVALS, zeroAddress, 3n, NO_MEMO])
			assert.equal((await vaquita.read.getPot([potId]))[2], 3n)
			await reverts(
				(await as(ana)).write.propose([potId, SET_APPROVALS, zeroAddress, 4n, NO_MEMO]),
				'BadApprovals'
			)
		})
	})

	describe('a pot that earns', () => {
		it('grows every part by Aave interest, in proportion', async () => {
			const { ana, beto, as, createPot, part, total, earn } = await setup({ earns: true })
			const potId = await createPot([ana.account.address, beto.account.address], 2n)
			await (await as(ana)).write.deposit([potId, usd(300)])
			await (await as(beto)).write.deposit([potId, usd(100)])
			await earn(10n)
			assert.equal(await total(potId), usd(440))
			assert.equal(await part(potId, ana.account.address), usd(330))
			assert.equal(await part(potId, beto.account.address), usd(110))
		})

		it('pays and withdraws from Aave, interest included', async () => {
			const { ana, beto, dani, as, createPot, part, balance, earn } = await setup({ earns: true })
			const potId = await createPot([ana.account.address, beto.account.address], 1n)
			await (await as(ana)).write.deposit([potId, usd(100)])
			await (await as(beto)).write.deposit([potId, usd(100)])
			await earn(5n)
			await (await as(ana)).write.propose([potId, PAY, dani.account.address, usd(70), NO_MEMO])
			assert.equal(await balance(dani.account.address), usd(1070))
			// 105 - 35 = 70, give or take the unit that rounding keeps in the pot's favour.
			const anaPart = await part(potId, ana.account.address)
			assert.ok(usd(70) - anaPart <= 1n, `${anaPart}`)
			await (await as(ana)).write.withdraw([potId, anaPart])
			assert.equal(await balance(ana.account.address), usd(900) + anaPart)
			assert.equal(await part(potId, ana.account.address), 0n)
		})

		it('lets someone who joined later earn only from then on', async () => {
			const { ana, beto, as, createPot, part, earn } = await setup({ earns: true })
			const potId = await createPot([ana.account.address, beto.account.address], 1n)
			await (await as(ana)).write.deposit([potId, usd(100)])
			await earn(10n)
			await (await as(beto)).write.deposit([potId, usd(110)])
			await earn(10n)
			assert.equal(await part(potId, ana.account.address), usd(121))
			assert.equal(await part(potId, beto.account.address), usd(121))
		})

		it('refunds a member who leaves with their part and its interest', async () => {
			const { ana, beto, as, createPot, balance, earn, total } = await setup({ earns: true })
			const potId = await createPot([ana.account.address, beto.account.address], 2n)
			await (await as(beto)).write.deposit([potId, usd(50)])
			await earn(2n)
			await (await as(beto)).write.leave([potId])
			assert.equal(await balance(beto.account.address), usd(1001))
			assert.equal(await total(potId), 0n)
		})

		it('keeps the money safe when Aave cannot pay out for a while', async () => {
			const { ana, as, createPot, part, aave } = await setup({ earns: true })
			const potId = await createPot([ana.account.address], 1n)
			await (await as(ana)).write.deposit([potId, usd(20)])
			await aave.write.setPaused([true])
			await reverts((await as(ana)).write.withdraw([potId, usd(5)]), 'no liquidity')
			assert.equal(await part(potId, ana.account.address), usd(20))
			await aave.write.setPaused([false])
			await (await as(ana)).write.withdraw([potId, usd(5)])
			assert.equal(await part(potId, ana.account.address), usd(15))
		})

		it('cannot earn on a network without Aave, or with a coin Aave does not list', async () => {
			const [ana] = await hre.viem.getWalletClients()
			const coin = await hre.viem.deployContract('TestStablecoin')
			const aave = await hre.viem.deployContract('TestAavePool')
			const noAave = await hre.viem.deployContract('TribuVaquita', [[coin.address], zeroAddress])
			await reverts(
				noAave.write.createPot([salt('a'), coin.address, true, [ana.account.address], 1n]),
				'EarningNotAvailable'
			)
			const unlisted = await hre.viem.deployContract('TribuVaquita', [[coin.address], aave.address])
			await reverts(
				unlisted.write.createPot([salt('a'), coin.address, true, [ana.account.address], 1n]),
				'EarningNotAvailable'
			)
		})
	})

	for (const earns of [false, true]) {
		it(`keeps every part, the pot total and the money held in step over random activity${earns ? ', while earning' : ''}`, async () => {
			const { ana, beto, caro, dani, as, createPot, part, total, held, earn } = await setup({ earns })
			const wallets = [ana, beto, caro]
			const potId = await createPot(
				wallets.map((w) => w.account.address),
				1n
			)
			let seed = 7
			const random = (n: number) => {
				seed = (seed * 1103515245 + 12345) % 2 ** 31
				return seed % n
			}
			for (let step = 0; step < 40; step++) {
				const who = wallets[random(3)]
				const pot = await total(potId)
				const choice = random(4)
				if (choice === 3 && earns) {
					await earn(BigInt(1 + random(3)))
				} else if (choice === 0 || choice === 3 || pot === 0n) {
					await (await as(who)).write.deposit([potId, BigInt(1 + random(5_000_000))])
				} else if (choice === 1) {
					const mine = await part(potId, who.account.address)
					if (mine > 0n) await (await as(who)).write.withdraw([potId, 1n + BigInt(random(Number(mine)))])
				} else {
					const amount = 1n + BigInt(random(Number(pot)))
					await (await as(who)).write.propose([potId, PAY, dani.account.address, amount, NO_MEMO])
				}
				const parts = await Promise.all(wallets.map((w) => part(potId, w.account.address)))
				const sum = parts.reduce((a, b) => a + b, 0n)
				const potTotal = await total(potId)
				// Each part rounds down to the unit, so with interest they can sum a few units short.
				assert.ok(sum <= potTotal && potTotal - sum < BigInt(wallets.length), `${sum} vs ${potTotal}`)
				assert.ok(potTotal <= (await held()), 'the pot never books more than the contract holds')
				if (!earns) assert.equal(sum, potTotal)
			}
		})
	}
})

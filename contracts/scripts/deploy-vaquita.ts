import hre from 'hardhat'

// The stablecoins a vaquita may hold, per network. They are fixed at deployment: the contract has
// no owner who could change them later.
const TOKENS: Record<string, `0x${string}`[]> = {
	// Circle's test USDC. Amoy has no official USDT; add a test USDT here if Tribu offers one.
	amoy: ['0x41E94Eb019C0762f9Bfcf9Fb1E58725BfB0e7582'],
	polygon: [
		'0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359', // USDC (native, not USDC.e)
		'0xc2132D05D31c914a87C6611C10748AEb04B58e8F', // USDT
	],
}

// Aave v3's Pool, where pots that earn put their money. Amoy has no Aave market for Circle's test
// USDC, so pots there cannot earn unless AAVE_POOL names a pool that lists the tokens above.
const AAVE_POOL: Record<string, `0x${string}`> = {
	polygon: '0x794a61358D6845594F94dc1DB02A252b5b4814aD',
}
const ZERO = '0x0000000000000000000000000000000000000000'

async function main() {
	const tokens = TOKENS[hre.network.name]
	if (!tokens) throw new Error(`no token list for network ${hre.network.name}`)
	const pool = (process.env.AAVE_POOL as `0x${string}` | undefined) ?? AAVE_POOL[hre.network.name] ?? ZERO
	const vaquita = await hre.viem.deployContract('TribuVaquita', [tokens, pool])
	console.log(`Aave pool: ${pool === ZERO ? 'none (pots cannot earn)' : pool}`)
	console.log(`TribuVaquita deployed on ${hre.network.name} at ${vaquita.address}`)
	console.log(`Set NEXT_PUBLIC_TRIBU_VAQUITA_ADDRESS=${vaquita.address} and redeploy the web app.`)
}

main().catch((error) => {
	console.error(error)
	process.exitCode = 1
})

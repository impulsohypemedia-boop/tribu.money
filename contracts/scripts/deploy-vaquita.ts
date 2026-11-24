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

async function main() {
	const tokens = TOKENS[hre.network.name]
	if (!tokens) throw new Error(`no token list for network ${hre.network.name}`)
	const vaquita = await hre.viem.deployContract('TribuVaquita', [tokens])
	console.log(`TribuVaquita deployed on ${hre.network.name} at ${vaquita.address}`)
	console.log(`Set NEXT_PUBLIC_TRIBU_VAQUITA_ADDRESS=${vaquita.address} and redeploy the web app.`)
}

main().catch((error) => {
	console.error(error)
	process.exitCode = 1
})

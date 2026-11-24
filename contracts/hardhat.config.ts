import path from 'node:path'
import { subtask } from 'hardhat/config'
import { TASK_COMPILE_SOLIDITY_GET_SOLC_BUILD } from 'hardhat/builtin-tasks/task-names'
import type { HardhatUserConfig } from 'hardhat/types'
import '@nomicfoundation/hardhat-viem'

const SOLC_VERSION = '0.8.24'

// Use the solc from npm (pinned in package.json) instead of downloading a compiler at build time,
// so a build needs nothing but the package registry.
subtask(TASK_COMPILE_SOLIDITY_GET_SOLC_BUILD, async (args: { solcVersion: string }, _hre, runSuper) => {
	if (args.solcVersion !== SOLC_VERSION) return runSuper()
	const solc = require('solc') as { version(): string }
	return {
		compilerPath: path.join(path.dirname(require.resolve('solc')), 'soljson.js'),
		isSolcJs: true,
		version: SOLC_VERSION,
		longVersion: solc.version(),
	}
})

// Deploying needs a funded key and an RPC URL, both from the environment; tests need neither.
const deployer = process.env.DEPLOYER_PRIVATE_KEY ? [process.env.DEPLOYER_PRIVATE_KEY] : []

const config: HardhatUserConfig = {
	solidity: { version: SOLC_VERSION, settings: { optimizer: { enabled: true, runs: 200 } } },
	networks: {
		amoy: {
			url: process.env.AMOY_RPC_URL ?? 'https://rpc-amoy.polygon.technology',
			accounts: deployer,
			chainId: 80002,
		},
		polygon: { url: process.env.POLYGON_RPC_URL ?? 'https://polygon-rpc.com', accounts: deployer, chainId: 137 },
	},
}

export default config

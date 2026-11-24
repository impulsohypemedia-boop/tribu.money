import { describe, expect, it, vi } from 'vitest'
import { erc20Abi } from 'viem'

vi.mock('@lemoncash/mini-app-sdk', () => ({
    callSmartContract: vi.fn(),
    ContractStandard: { ERC20: 'ERC20' },
    TransactionResult: { SUCCESS: 'SUCCESS', PENDING: 'PENDING', CANCELLED: 'CANCELLED', FAILED: 'FAILED' },
}))

const { typedArgs } = await import('./vaquita-client')
const { VAQUITA_ABI } = await import('./vaquita')

describe('typedArgs', () => {
    it("turns Lemon's string amounts into the integers a browser wallet needs", () => {
        const pot = `0x${'ab'.repeat(32)}`
        expect(typedArgs(VAQUITA_ABI, 'deposit', [pot, '1500000'])).toEqual([pot, 1_500_000n])
        expect(typedArgs(erc20Abi, 'approve', ['0x1111111111111111111111111111111111111111', '7'])).toEqual([
            '0x1111111111111111111111111111111111111111',
            7n,
        ])
    })

    it('keeps booleans and addresses as they are', () => {
        const args = typedArgs(VAQUITA_ABI, 'createPot', [
            '0x' + '00'.repeat(32),
            '0x' + '11'.repeat(20),
            true,
            [],
            '1',
        ])
        expect(args).toEqual(['0x' + '00'.repeat(32), '0x' + '11'.repeat(20), true, [], 1n])
    })

    it('refuses a function the contract does not have', () => {
        expect(() => typedArgs(VAQUITA_ABI, 'drain', [])).toThrow('unknown function drain')
    })
})

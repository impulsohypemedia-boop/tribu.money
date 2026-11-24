# Tribu contracts

`TribuVaquita.sol` turns a vaquita into a real wallet: the tribu's USDC or USDT sits in this
contract instead of in one member's account.

## How it works

- **No owner.** There is no admin key, pause or upgrade. Tribu cannot move, freeze or take anyone's
  money. One deployment holds every tribu's pot, each kept apart by its id.
- **Each member has a part.** A deposit adds to the depositor's part. A payment from the pot comes
  out of every part in proportion to its size.
- **Payments need approvals.** A member proposes a payment; it goes out once the number of
  approvals the pot asks for is reached (proposing counts as one). The same rule adds or removes
  members and changes the number.
- **Nobody is locked in.** Any member can take out their own part, or leave with it, at any time.
- Only the stablecoins listed at deployment are accepted.

## Test

```bash
pnpm install --ignore-workspace
pnpm test
```

The compiler comes from the `solc` npm package, so nothing is downloaded at build time.

## Deploy

Needs a wallet with a little POL for gas. Its private key is only used for this one transaction;
the deployer gets no power over the contract.

```bash
DEPLOYER_PRIVATE_KEY=0x… pnpm deploy:amoy      # testnet first
DEPLOYER_PRIVATE_KEY=0x… pnpm deploy:polygon   # real money
```

Then set `NEXT_PUBLIC_TRIBU_VAQUITA_ADDRESS` in the web app's environment and redeploy it. Until
it is set, the app shows no wallet option.

## Before real money

This contract has tests but no external audit. Get one before a pot holds amounts people would
miss. USDC and USDT can freeze any address, this contract included; that is a property of those
tokens, not something this contract can prevent.

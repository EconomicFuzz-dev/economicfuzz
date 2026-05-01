# DeFi Attack Glossary

A working dictionary of attack patterns we model in YAML scenarios.
Terms are listed in rough order of prevalence on Solana mainnet.

---

## oracle manipulation
An attacker pushes a price feed off its true value (e.g. by trading large size
on a thinly-quoted venue the oracle samples) and redeems collateral at the
distorted rate. Modeled in `scenarios/oracle_manipulation.yaml`.

## stale oracle
The feed has not updated in N seconds while the underlying market moved.
Anyone who notices first can withdraw against the lagged price.
See `scenarios/stale_oracle.yaml`.

## sandwich attack
Front-run a known swap and immediately back-run it. Profit = victim slippage.
See `scenarios/sandwich_attack.yaml`.

## flash-loan reentrancy
Atomic borrow used to satisfy preconditions of a vulnerable instruction, then
the loan is repaid in the same tx. Often combined with oracle distortion.
See `scenarios/flash_loan_reentrancy.yaml`.

## just-in-time (JIT) liquidity drain
LP injects liquidity right before a known large swap, captures fees, withdraws.
Drains organic LP yield while contributing nothing.

## governance grief
Submit proposals that pass minimum quorum but inflict costs on protocol — e.g.
fee changes, parameter ranges that break invariants.
See `scenarios/governance_grief.yaml`.

## MEV (priority fee front-run)
Same as sandwich but only the first leg — the attacker buys before a profit
opportunity is publicly known.

## double-spend (validator reorg)
A privileged validator re-orders its own block to invalidate a victim tx that
was already considered final by user-space. Rare but historically observed.

## DOS via account write-lock
A spam tx holds a lock on a hot account preventing legitimate txs from landing.
Not direct theft but breaks user experience.

## price-impact manipulation (whale fake-out)
Attacker takes a position, pumps the underlying through cross-venue trade,
liquidates competing leveraged positions, then closes.

## reentrancy via callback
Attacker hooks a callback in a CPI that re-enters the original program before
state is committed.

## validator censorship
Validator drops or delays inclusion of specific txs. Targets liquidations or
oracle updates.

## governance proposal squeeze
Fast-tracked emergency proposals on low-attention timeline. Equivalent to
admin-only changes without admin keys.

## token mint exhaustion
Mint authority abused to dump supply, deflating LP positions.

## just-in-time MEV bundle
Collection of front-runs/back-runs bundled for atomic profit, often via
custom validator clients.

---

> **A scenario YAML may compose several of these.** The genetic fuzzer tries
> different orderings and parameter sweeps to find which combinations breach
> the declared invariants in `cli/src/core/genetic-fuzzer.ts`.

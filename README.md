# EconomicFuzz

Economic attack simulation framework for DeFi protocols on Solana.

## Threat Model

EconomicFuzz simulates economic attacks across five categories:

1. **Oracle Manipulation** -- Price feed deviation exploits targeting liquidation logic
2. **Flash Loan Attacks** -- Single-transaction arbitrage and drain patterns, including reentrancy paths
3. **MEV Extraction** -- Sandwich attacks, frontrunning, and JIT liquidity withdrawal
4. **Stale Oracle Exploits** -- Lazy consumers that ignore `publish_time` on Pyth feeds
5. **Governance Griefing** -- Spam proposals stalling the queue, blocking real votes

### Scope

EconomicFuzz **does** model:

- Tx-level attack sequences against on-chain state forked from devnet
- Genetic search over scenario parameters (slippage, oracle drift, borrow size)
- Invariant breaches (attacker profit, pool solvency, max-pending-proposals)
- Cost / gas accounting for each step in the chain

EconomicFuzz **does not** model:

- Mainnet replay or live exploit execution -- forks only, never sends real txs
- Off-chain coordination (bot mempools, validator tipping, social engineering)
- Cryptographic primitive failures -- assumes signatures, hashes, and PDAs work
- Long-term game-theoretic outcomes beyond a single simulation horizon

### Adversary Capability

The default attacker is assumed to have:

- Public knowledge of program source / IDL
- Ability to submit any tx an unprivileged user could submit
- Access to a flash loan provider (10M+ USDC capacity)
- One block of priority over honest users for ordering attacks

Attacks requiring validator collusion, root-key compromise, or supply-chain
backdoors are **out of scope** -- those are surface for separate threat
modeling, not economic simulation.

## Quick Start

```bash
cd cli && npm install && npm run build

# Scan a program for attack surface
ecofuzz scan <PROGRAM_ID>

# Run a YAML attack scenario
ecofuzz attack scenarios/oracle_manipulation.yaml

# Evolve optimal attack parameters
ecofuzz fuzz scenarios/sandwich_attack.yaml

# Generate vulnerability report
ecofuzz report ./output
```

## YAML Scenario Format

### Oracle Manipulation

```yaml
name: oracle_deviation_attack
attack_type: oracle_manipulation

setup:
  fork_from: devnet
  accounts:
    pyth_feed: "<pyth_feed_address>"
    pool: "<pool_address>"

attack_sequence:
  - action: manipulate_oracle
    params:
      deviation_pct: 15
      duration_slots: 5
      feed: "<pyth_feed_address>"
  - action: execute_liquidation
    params:
      target_position: "<position>"
  - action: restore_price
    params:
      feed: "<pyth_feed_address>"

invariants:
  - check: attacker_profit
    condition: "attacker_profit > 0"
  - check: protocol_tvl_drain
    condition: "vault_balance_change < 0.01"

fuzzer_config:
  strategy: genetic
  parameters:
    deviation_pct: { min: 5, max: 80 }
    duration_slots: { min: 1, max: 50 }
  population: 50
  generations: 100
```

### Sandwich Attack

```yaml
name: sandwich_basic
attack_type: sandwich

attack_sequence:
  - action: frontrun_buy
    params:
      frontrun_amount: 100
      target_pool: "<pool>"
  - action: victim_swap
    params:
      victim_amount: 50
  - action: backrun_sell
    params:
      sell_all: true

invariants:
  - check: sandwich_profit
    condition: "attacker_profit > 0"
  - check: victim_slippage
    condition: "victim_slippage < 0.05"

fuzzer_config:
  strategy: genetic
  parameters:
    frontrun_amount: { min: 10, max: 500 }
  population: 30
  generations: 50
```

## Report Output

```
$ ecofuzz report ./output

  Vulnerability Report
  ════════════════════════════════════════

  Scan Date:     2026-04-10
  Program:       DeFiPool_v2
  Scenarios Run: 2

  ┌────────────────────────┬──────────┬───────────────┐
  │ Finding                │ Severity │ Est. Loss     │
  ├────────────────────────┼──────────┼───────────────┤
  │ Oracle price deviation │ CRITICAL │ $12,400       │
  │ Sandwich profitability │ HIGH     │ $890/trade    │
  │ Liquidation cascade    │ MEDIUM   │ $3,200        │
  └────────────────────────┴──────────┴───────────────┘

  Best attack params (genetic fuzzer):
    deviation_pct: 23.5
    duration_slots: 8
    fitness: 0.847

  Report saved to: ./output/report_2026-04-10.json
```

## Stack

- TypeScript CLI (commander.js, chalk, ora, yaml)
- Genetic fuzzer (population, crossover, mutation, convergence)
- Oracle price simulator
- Step-by-step attack executor

## Scenario Gallery

Bundled YAML attack scenarios in `scenarios/`:

| file | category | what it models |
|------|----------|----------------|
| `oracle_manipulation.yaml`     | oracle  | Pyth feed deviation against a price-dependent pool |
| `oracle_drift_cooldown.yaml`   | oracle  | Pulsed deviation evading consecutive-sample detectors |
| `stale_oracle.yaml`            | oracle  | Lazy consumer ignoring `publish_time` on a Pyth feed |
| `sandwich_attack.yaml`         | mev     | Front-run + back-run around a target swap |
| `flash_loan_reentrancy.yaml`   | flash   | Single-tx drain via re-entered borrow path |
| `jit_liquidity_drain.yaml`     | mev     | JIT add/remove liquidity around a victim trade |
| `governance_grief.yaml`        | gov     | Spam proposals stalling the queue |
| `double_spend_reorg.yaml`      | consensus | Tx replay across a forced fork |

Run any scenario via `ecofuzz attack scenarios/<file>.yaml`. The fuzzer mutates parameters within the bounds declared in `fuzzer_config:` and reports invariant breaks per generation.

## License

Released under MIT — see [LICENSE](LICENSE). Scenarios, fuzzer harness, and reporting code are published openly so defenders can replicate findings against systems they own or have written authorization to test. Use against third-party deployments without consent falls outside the threat model documented above and outside the permissions granted by this license. The "AS IS" clause is not a footnote: an economic-attack simulator can produce false negatives, and any invariant that holds in the harness must still be argued in production.

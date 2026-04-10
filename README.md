# EconomicFuzz

Economic attack simulation framework for DeFi protocols on Solana.

## Threat Model

EconomicFuzz simulates three categories of economic attacks:

1. **Oracle Manipulation** -- Price feed deviation exploits targeting liquidation logic
2. **Flash Loan Attacks** -- Single-transaction arbitrage and drain patterns
3. **MEV Extraction** -- Sandwich attacks, frontrunning, and JIT liquidity

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

## License

MIT

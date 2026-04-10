# EconomicFuzz

Economic attack simulation framework for DeFi protocols on Solana.

## Threat Model

EconomicFuzz simulates three categories of economic attacks:

1. **Oracle Manipulation** — Price feed deviation exploits
2. **Flash Loan Attacks** — Single-transaction arbitrage and drain patterns
3. **MEV Extraction** — Sandwich attacks, frontrunning, and JIT liquidity

## Usage

Define attack scenarios in YAML:

```yaml
# scenario.yaml
name: oracle_deviation_attack
description: "Deviate oracle price to exploit liquidation logic"
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

invariants:
  - check: vault_balance
    condition: "vault_balance_change < 0.01"

fuzzer_config:
  strategy: genetic
  parameters:
    deviation_pct:
      min: 5
      max: 80
  population: 50
  generations: 100
```

```bash
# Scan a program for attack surface
ecofuzz scan <PROGRAM_ID>

# Run YAML attack scenario
ecofuzz attack scenario.yaml

# Genetic fuzzer — evolve attack parameters
ecofuzz fuzz scenario.yaml

# Generate vulnerability report
ecofuzz report ./output
```

## Stack

- Rust core — simulation engine + genetic fuzzer
- TypeScript CLI
- D3.js Sankey dashboard — attack path visualization

## Dev

```bash
cargo build --release
cd cli && npm install && npm run build
node dist/index.js attack scenarios/oracle_manipulation.yaml
```

## License

MIT

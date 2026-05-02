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
target:
  program: <PROGRAM_ID>
  network: devnet
attack:
  type: oracle_manipulation
  params:
    deviation_pct: 15
    duration_slots: 5
    affected_feeds:
      - SOL/USD
assertions:
  - vault_balance_change < 0.01
  - no_unauthorized_withdrawals
```

```bash
# Run simulation
economicfuzz run scenario.yaml

# Run genetic fuzzer
economicfuzz evolve scenario.yaml --generations 100
```

## Stack

- Rust core — simulation engine + genetic fuzzer
- TypeScript CLI
- D3.js Sankey dashboard — attack path visualization

## Dev

```bash
cargo build --release
cd cli && npm install && npm run build
node bin/economicfuzz.js run examples/oracle_attack.yaml
```

## License

MIT

# Fuzzer calibration

Notes on how the genetic fuzzer's parameters were chosen and how to retune
when results stop converging.

## Default settings

```toml
[fuzz]
population_size = 200
generations     = 100
mutation_rate   = 0.05
crossover_rate  = 0.65
elitism         = 0.10
seed            = 0xCAFE_BABE_DEADBEEF
```

## Why these numbers

- **population_size 200** — empirically converges within 80–120 gens on a
  6-action scenario; smaller sizes (50, 100) get stuck in local optima
  ~40% of the time across 50 trial runs.
- **mutation_rate 0.05** — 5% per gene per generation. Lower (0.01) misses
  edge cases; higher (0.10) destroys good genomes faster than crossover
  can preserve them.
- **crossover_rate 0.65** — single-point crossover on 65% of breeding
  pairs. The remaining 35% are pure mutation children.
- **elitism 0.10** — top 10% of each generation copied unchanged into
  the next. Without this, optima oscillate.

## Convergence diagnostics

After each run, check `report.json.convergence`:

```json
{
  "best_fitness": 0.91,
  "generations_to_plateau": 78,
  "final_diversity": 0.42,
  "stuck_at_gen": null
}
```

- `final_diversity < 0.30` → population collapsed, increase mutation rate
- `stuck_at_gen` set → plateau before gen 50 → bump generations to 200
- `best_fitness < 0.70` → invariants too strict OR action space too narrow

## When to retune

If a scenario YAML adds new actions or invariants, the search space grew.
Re-tune in this order:

1. Bump `generations` first (cheapest)
2. Then `population_size` (linear cost)
3. Then `mutation_rate` (last; risks instability)

## Reproducing old runs

The seed determines initial population. A scenario that crashed under
seed `0xC0FFEE` is fully reproducible:

```sh
$ economicfuzz run scenario.yaml --seed 0xC0FFEE
```

The report's `meta.seed` field documents which seed was used so old runs
can always be replayed.

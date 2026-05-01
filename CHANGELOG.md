# changelog

economic attack simulator for solana defi.

## [0.1.0] — phase 5: cli + landing

- core fuzzer in rust — genetic search over scenario param space
- 3 yaml scenarios: oracle manipulation, mev sandwich, flash loan loop
- typescript cli wrapping the rust binary, json report export
- d3 sankey dashboard showing fund flow + invariant breaches
- war room landing page with live attack-simulator demo
- 3 scenario tabs on landing
- e2e verified: cli runs all 3 scenarios end-to-end

## [unreleased] — 0.2.0 prep

- new yaml scenarios: flash loan reentrancy, stale oracle, jit liquidity, governance grief
- fuzzer: tournament selection, mutation rate decay, phenotype dedupe
- sankey: legend color mapping fix + tooltip with profit / cost split
- dashboard: scenario filter chips
- cli: severity color legend in terminal output
- readme: threat model section + yaml schema reference
- ci: github actions running cargo clippy + ts lint
- cli: align binary name to `economicfuzz` (was `ecofuzz`)

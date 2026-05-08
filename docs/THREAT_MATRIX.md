# Threat × mitigation matrix

A cross-reference between attack patterns and the on-chain mitigations we've
seen deployed against them. Each cell answers "if attack X meets mitigation Y,
who wins?" — useful when reviewing a new protocol design.

Legend:
- ✗ = mitigation **does not** stop this attack
- ⚠ = partially blocks (raises cost, doesn't eliminate)
- ✓ = effectively blocks the attack

|                          | TWAP oracle | Multi-oracle median | Slippage cap | Per-tx flash-loan check | Time-lock on params |
|--------------------------|:-----------:|:-------------------:|:------------:|:-----------------------:|:-------------------:|
| oracle manipulation      |     ⚠       |          ✓          |      ⚠       |            ✗            |          ✗          |
| stale oracle             |     ✓       |          ✓          |      ✗       |            ✗            |          ✗          |
| sandwich attack          |     ✗       |          ✗          |      ✓       |            ✗            |          ✗          |
| flash-loan reentrancy    |     ⚠       |          ⚠          |      ✗       |            ✓            |          ✗          |
| JIT liquidity drain      |     ✗       |          ✗          |      ⚠       |            ⚠            |          ✗          |
| governance grief         |     ✗       |          ✗          |      ✗       |            ✗            |          ✓          |
| MEV front-run            |     ✗       |          ✗          |      ✓       |            ✗            |          ✗          |
| double-spend (reorg)     |     ⚠       |          ⚠          |      ✗       |            ✗            |          ✗          |
| validator censorship     |     ✗       |          ✗          |      ✗       |            ✗            |          ✗          |
| price-impact fake-out    |     ⚠       |          ⚠          |      ✓       |            ✗            |          ✗          |

## Reading the matrix

Run a column down to find which attacks a given mitigation actually defeats —
slippage caps stop sandwich and price-impact, but do nothing against oracle
manipulation. Run a row across to see what stack you'd need to neutralize a
particular attack — flash-loan reentrancy is fully blocked only by an
explicit per-tx flash-loan check.

## What's *missing* from this matrix

Mitigations we considered but excluded because they're either too rare or too
project-specific:
- Privileged liquidator pause (good against double-spend, bad UX)
- Oracle staleness blacklists (subset of "stale oracle" defense)
- MEV-resistant orderflow auctions (Solana-native — Jito, Helius)
- Cross-program invocation depth caps (Solana feature, not a per-protocol decision)

## Generating new YAML scenarios

When you spot a row that's all-✗, that attack is *unmitigated by the standard
toolkit* and is therefore the highest-leverage scenario to encode.

```
$ npx economicfuzz scaffold scenario governance_grief_timelock_bypass
```

Look at recent matrix-row exploits in protocols like Mango (oracle manip
without TWAP), Cream Finance (flash-loan + reentrancy), and the perennial
sandwich-on-Jupiter for inspiration.

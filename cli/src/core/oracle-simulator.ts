// liquidation bots don't capture 100% of price-discrepancy value:
// - keepers race for the same liquidation, gas auctions eat into margin
// - protocol takes a liquidation fee (typically 5-10%) before the rest is split
// - slippage on the discounted-collateral exit
// 80% reflects "well-tuned MEV bot in a quiet block" — upper bound for back-of-envelope analysis.
const LIQUIDATION_CAPTURE_RATE = 0.8

// confidence interval as a fraction of the price — Pyth typically ~0.05-0.2%.
const ORACLE_CONFIDENCE_RATIO = 0.001

export interface ManipulationResult {
  originalPrice: number
  manipulatedPrice: number
  deviationPct: number
  profitEstimate: number
  captureRate: number
}

export function simulateOracleAttack(
  basePrice: number,
  deviationPct: number,
  positionSize: number,
  captureRate: number = LIQUIDATION_CAPTURE_RATE,
): ManipulationResult {
  const priceDropAbs = basePrice * (deviationPct / 100)
  const manipulatedPrice = Math.max(0, basePrice - priceDropAbs)

  // estimate profit: liquidation proceeds at depressed price, capture fraction of discount
  const profitEstimate = positionSize * (deviationPct / 100) * captureRate

  return {
    originalPrice: basePrice,
    manipulatedPrice,
    deviationPct,
    profitEstimate,
    captureRate,
  }
}

// helper for callers that want to model a stateful oracle (e.g. consecutive manipulations)
export interface OracleState {
  feedId: string
  basePrice: number
  currentPrice: number
  confidence: number
  lastUpdate: number
}

export function createOracleState(feedId: string, basePrice: number): OracleState {
  return {
    feedId,
    basePrice,
    currentPrice: basePrice,
    confidence: basePrice * ORACLE_CONFIDENCE_RATIO,
    lastUpdate: Date.now(),
  }
}

export function applyManipulation(oracle: OracleState, deviationPct: number): OracleState {
  const deviation = oracle.basePrice * (deviationPct / 100)
  return {
    ...oracle,
    currentPrice: Math.max(0, oracle.basePrice - deviation),
    lastUpdate: Date.now(),
  }
}

export interface OracleState {
  feedId: string
  basePrice: number
  currentPrice: number
  confidence: number
  lastUpdate: number
}

export interface ManipulationResult {
  originalPrice: number
  manipulatedPrice: number
  deviationPct: number
  profitEstimate: number
}

export function createOracleState(feedId: string, basePrice: number): OracleState {
  return {
    feedId,
    basePrice,
    currentPrice: basePrice,
    confidence: basePrice * 0.001,
    lastUpdate: Date.now(),
  }
}

export function manipulatePrice(
  oracle: OracleState,
  deviationPct: number
): ManipulationResult {
  const deviation = oracle.basePrice * (deviationPct / 100)
  const manipulated = oracle.basePrice - deviation

  oracle.currentPrice = Math.max(0, manipulated)
  oracle.lastUpdate = Date.now()

  return {
    originalPrice: oracle.basePrice,
    manipulatedPrice: oracle.currentPrice,
    deviationPct,
    profitEstimate: 0,
  }
}

export function simulateOracleAttack(
  basePrice: number,
  deviationPct: number,
  positionSize: number
): ManipulationResult {
  const priceDropAbs = basePrice * (deviationPct / 100)
  const manipulatedPrice = Math.max(0, basePrice - priceDropAbs)

  // estimate profit: liquidation proceeds minus position value at manipulated price
  const profitEstimate = positionSize * (deviationPct / 100) * 0.8 // 80% capture rate

  return {
    originalPrice: basePrice,
    manipulatedPrice,
    deviationPct,
    profitEstimate,
  }
}

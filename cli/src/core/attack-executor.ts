import { Scenario, AttackStep } from './scenario-parser'
import { simulateOracleAttack } from './oracle-simulator'

export interface StepResult {
  step: number
  action: string
  success: boolean
  output: Record<string, unknown>
}

export interface AttackResult {
  scenario: string
  attackType: string
  steps: StepResult[]
  invariantsChecked: number
  invariantsPassed: number
  totalProfit: number
  duration: number
}

export function executeAttack(scenario: Scenario): AttackResult {
  const startTime = Date.now()
  const steps: StepResult[] = []
  let totalProfit = 0

  for (let i = 0; i < scenario.attack_sequence.length; i++) {
    const step = scenario.attack_sequence[i]
    const result = executeStep(step, i, scenario)
    steps.push(result)

    if (!result.success) break // stop on failed step

    if (result.output.profit) {
      totalProfit += result.output.profit as number
    }
  }

  // check invariants
  let invariantsPassed = 0
  for (const inv of scenario.invariants || []) {
    const passed = checkInvariant(inv.condition, { totalProfit, steps })
    if (passed) invariantsPassed++
  }

  return {
    scenario: scenario.name,
    attackType: scenario.attack_type,
    steps,
    invariantsChecked: scenario.invariants?.length || 0,
    invariantsPassed,
    totalProfit,
    duration: Date.now() - startTime,
  }
}

function executeStep(
  step: AttackStep,
  index: number,
  scenario: Scenario
): StepResult {
  const params = step.params || {}

  switch (step.action) {
    case 'manipulate_oracle':
    case 'manipulate_price': {
      const deviation = (params.deviation_pct as number) || 50
      const positionSize = (params.position_size as number) || 1000
      const basePrice = (params.base_price as number) || 100
      const result = simulateOracleAttack(basePrice, deviation, positionSize)
      return {
        step: index,
        action: step.action,
        success: true,
        output: {
          manipulatedPrice: result.manipulatedPrice,
          profit: result.profitEstimate,
        },
      }
    }

    case 'frontrun_buy':
    case 'backrun_sell': {
      const amount = (params.amount as number) || 100
      const slippage = Math.random() * 5 // 0-5% simulated slippage
      return {
        step: index,
        action: step.action,
        success: true,
        output: {
          amount,
          slippage: Math.round(slippage * 100) / 100,
          profit: amount * (slippage / 100),
        },
      }
    }

    case 'execute_liquidation':
    case 'victim_swap':
    case 'restore_price': {
      return {
        step: index,
        action: step.action,
        success: true,
        output: { simulated: true },
      }
    }

    default: {
      return {
        step: index,
        action: step.action,
        success: false,
        output: { error: `unknown action: ${step.action}` },
      }
    }
  }
}

function checkInvariant(
  condition: string,
  context: { totalProfit: number; steps: StepResult[] }
): boolean {
  // simple invariant evaluation
  if (condition.includes('profit') && condition.includes('>') && condition.includes('0')) {
    return context.totalProfit > 0
  }
  if (condition.includes('slippage') && condition.includes('>')) {
    const anySlippage = context.steps.some(
      (s) => (s.output.slippage as number) > 0
    )
    return anySlippage
  }
  // default: pass
  return true
}

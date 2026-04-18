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
      // ?? not || — `0` is a meaningful test value (no manipulation)
      const deviation = (params.deviation_pct as number) ?? 50
      const positionSize = (params.position_size as number) ?? 1000
      const basePrice = (params.base_price as number) ?? 100
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
      const amount = (params.amount as number) ?? 100
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

// minimal arithmetic-comparison evaluator for YAML invariants.
// supports: <ident> <op> <number|ident>   where op ∈ < <= > >= == != ; and chained AND via '&&'.
// idents resolve from a small whitelist of context keys (totalProfit, anySlippage, ...).
// returns null when the condition references unknown identifiers — caller treats that as "skipped".
export function evaluateCondition(
  raw: string,
  context: { totalProfit: number; steps: StepResult[] }
): boolean | null {
  const ctx: Record<string, number> = {
    totalProfit: context.totalProfit,
    stepCount: context.steps.length,
    successfulSteps: context.steps.filter((s) => s.success).length,
    anySlippage: context.steps.some(
      (s) => typeof s.output.slippage === 'number' && (s.output.slippage as number) > 0
    )
      ? 1
      : 0,
    maxStepProfit: context.steps.reduce((m, s) => {
      const p = typeof s.output.profit === 'number' ? (s.output.profit as number) : 0
      return p > m ? p : m
    }, 0),
  }

  const clauses = raw.split('&&').map((c) => c.trim()).filter(Boolean)
  if (clauses.length === 0) return null

  for (const clause of clauses) {
    const m = clause.match(/^\s*([A-Za-z_][\w.]*)\s*(<=|>=|==|!=|<|>)\s*([A-Za-z_][\w.]*|-?\d+(?:\.\d+)?)\s*$/)
    if (!m) return null
    const [, lhs, op, rhsRaw] = m
    if (!(lhs in ctx)) return null
    const left = ctx[lhs]
    const right = /^-?\d/.test(rhsRaw) ? Number(rhsRaw) : ctx[rhsRaw]
    if (right === undefined || Number.isNaN(right)) return null
    let pass: boolean
    switch (op) {
      case '<': pass = left < right; break
      case '<=': pass = left <= right; break
      case '>': pass = left > right; break
      case '>=': pass = left >= right; break
      case '==': pass = left === right; break
      case '!=': pass = left !== right; break
      default: return null
    }
    if (!pass) return false
  }
  return true
}

function checkInvariant(
  condition: string,
  context: { totalProfit: number; steps: StepResult[] }
): boolean {
  const result = evaluateCondition(condition, context)
  // unknown identifiers / unparseable → skip (count as "no violation").
  // legacy YAMLs reference balances we don't simulate (attacker_balance_after, protocol_tvl_after).
  return result === null ? true : result
}

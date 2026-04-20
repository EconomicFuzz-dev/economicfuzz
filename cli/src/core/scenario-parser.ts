import * as fs from 'fs'
import YAML from 'yaml'

export interface AttackStep {
  action: string
  params: Record<string, unknown>
}

export interface Invariant {
  check: string
  condition: string
}

export interface FuzzerConfig {
  strategy: string
  parameters: Record<string, { min: number; max: number }>
  population?: number
  generations?: number
}

export interface Scenario {
  name: string
  description: string
  attack_type: string
  setup: {
    fork_from: string
    accounts: Record<string, string>
  }
  // top-level scenario tuning (cost models, baseline assumptions)
  params?: Record<string, unknown>
  attack_sequence: AttackStep[]
  invariants: Invariant[]
  fuzzer_config: FuzzerConfig
}

export function loadScenario(filepath: string): Scenario {
  if (!fs.existsSync(filepath)) {
    throw new Error(`scenario file not found: ${filepath}`)
  }

  const raw = fs.readFileSync(filepath, 'utf-8')
  const parsed = YAML.parse(raw)

  if (parsed === null || parsed === undefined) {
    throw new Error(`scenario file is empty or contains only comments: ${filepath}`)
  }
  if (typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(`scenario root must be a YAML mapping (got ${Array.isArray(parsed) ? 'array' : typeof parsed})`)
  }
  if (!parsed.name || !parsed.attack_type || !parsed.attack_sequence) {
    throw new Error('invalid scenario: missing name, attack_type, or attack_sequence')
  }

  return parsed as Scenario
}

export function validateScenario(scenario: Scenario): string[] {
  const errors: string[] = []

  if (!scenario.setup?.fork_from) {
    errors.push('setup.fork_from is required')
  }
  if (!scenario.attack_sequence || scenario.attack_sequence.length === 0) {
    errors.push('attack_sequence must have at least one step')
  }
  if (!scenario.invariants || scenario.invariants.length === 0) {
    errors.push('at least one invariant is recommended')
  }

  return errors
}

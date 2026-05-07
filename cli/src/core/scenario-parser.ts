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

  let parsed: unknown
  try {
    parsed = YAML.parse(raw)
  } catch (err) {
    // YAML library throws compact one-line errors that hide the line number
    // for tab-vs-space confusions and unclosed quotes. Re-frame so the user
    // gets a pointer into the actual file.
    const inner = err instanceof Error ? err.message : String(err)
    throw new Error(
      `failed to parse YAML in ${filepath}\n` +
      `  reason: ${inner}\n` +
      `  hint:   indentation must be spaces (not tabs); strings with ':' or '#' must be quoted; ` +
      `lists need a leading "- ".`
    )
  }

  if (parsed === null || parsed === undefined) {
    throw new Error(`scenario file is empty or contains only comments: ${filepath}`)
  }
  if (typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(`scenario root must be a YAML mapping (got ${Array.isArray(parsed) ? 'array' : typeof parsed})`)
  }
  const obj = parsed as Record<string, unknown>
  const missing: string[] = []
  if (!obj.name) missing.push('name')
  if (!obj.attack_type) missing.push('attack_type')
  if (!obj.attack_sequence) missing.push('attack_sequence')
  if (missing.length > 0) {
    throw new Error(
      `invalid scenario: missing required field(s): ${missing.join(', ')}\n` +
      `  file: ${filepath}\n` +
      `  see scenarios/oracle_manipulation.yaml for a reference shape.`
    )
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

import { Scenario } from './scenario-parser'
import { executeAttack, AttackResult } from './attack-executor'
import { rand } from './rng'

export interface Individual {
  params: Record<string, number>
  fitness: number
}

export interface FuzzRunResult {
  generations: number
  populationSize: number
  bestFitness: number
  bestParams: Record<string, number>
  convergenceHistory: number[]
  totalAttacks: number
  profitableAttacks: number
}

// genetic-algorithm tunables — kept top-of-file so they're easy to find and tune
const ELITE_FRACTION = 0.5  // top half survives unchanged each generation
const MUTATION_RATE = 0.15  // probability a given parameter gets re-randomised

function randomInRange(min: number, max: number): number {
  return min + rand() * (max - min)
}

function createIndividual(
  paramRanges: Record<string, { min: number; max: number }>
): Individual {
  const params: Record<string, number> = {}
  for (const [key, range] of Object.entries(paramRanges)) {
    params[key] = randomInRange(range.min, range.max)
  }
  return { params, fitness: 0 }
}

function evaluateFitness(individual: Individual, scenario: Scenario): number {
  // inject individual's params into scenario steps
  const modifiedScenario = { ...scenario }
  modifiedScenario.attack_sequence = scenario.attack_sequence.map((step) => ({
    ...step,
    params: { ...step.params, ...individual.params },
  }))

  const result = executeAttack(modifiedScenario)
  return result.totalProfit
}

function crossover(a: Individual, b: Individual): Individual {
  const child: Record<string, number> = {}
  for (const key of Object.keys(a.params)) {
    child[key] = rand() > 0.5 ? a.params[key] : b.params[key]
  }
  return { params: child, fitness: 0 }
}

function mutate(
  individual: Individual,
  paramRanges: Record<string, { min: number; max: number }>,
  rate: number = 0.1
): Individual {
  const mutated = { ...individual.params }
  for (const [key, range] of Object.entries(paramRanges)) {
    if (rand() < rate) {
      mutated[key] = randomInRange(range.min, range.max)
    }
  }
  return { params: mutated, fitness: 0 }
}

export function runGeneticFuzzer(scenario: Scenario): FuzzRunResult {
  const config = scenario.fuzzer_config
  const paramRanges = config.parameters || {}
  const popSize = config.population || 30
  const gens = config.generations || 50

  // initialize population
  let population: Individual[] = []
  for (let i = 0; i < popSize; i++) {
    population.push(createIndividual(paramRanges))
  }

  const convergenceHistory: number[] = []
  let totalAttacks = 0
  let profitableAttacks = 0

  for (let gen = 0; gen < gens; gen++) {
    // evaluate fitness
    for (const ind of population) {
      ind.fitness = evaluateFitness(ind, scenario)
      totalAttacks++
      if (ind.fitness > 0) profitableAttacks++
    }

    // sort by fitness (highest first)
    population.sort((a, b) => b.fitness - a.fitness)
    convergenceHistory.push(population[0].fitness)

    // selection: elites carry forward
    const survivors = population.slice(0, Math.floor(popSize * ELITE_FRACTION))

    // breed next generation — explicit count beats while-with-mutation-target
    const childrenNeeded = popSize - survivors.length
    const children: Individual[] = []
    for (let i = 0; i < childrenNeeded; i++) {
      const parentA = survivors[Math.floor(rand() * survivors.length)]
      const parentB = survivors[Math.floor(rand() * survivors.length)]
      let child = crossover(parentA, parentB)
      child = mutate(child, paramRanges, MUTATION_RATE)
      children.push(child)
    }

    population = [...survivors, ...children]
  }

  // final evaluation
  population.sort((a, b) => b.fitness - a.fitness)
  const best = population[0]

  return {
    generations: gens,
    populationSize: popSize,
    bestFitness: best.fitness,
    bestParams: best.params,
    convergenceHistory,
    totalAttacks,
    profitableAttacks,
  }
}

#!/usr/bin/env node
import { Command } from "commander";
import * as fs from "fs";
import * as path from "path";
import chalk from "chalk";
import { loadScenario, validateScenario } from "./core/scenario-parser";
import { executeAttack, AttackResult } from "./core/attack-executor";
import { runGeneticFuzzer } from "./core/genetic-fuzzer";
import { setSeed } from "./core/rng";

function parseSeed(raw: string | undefined): number | undefined {
  if (raw === undefined) return undefined;
  const n = Number(raw);
  if (!Number.isFinite(n) || !Number.isInteger(n) || n < 0) {
    throw new Error(`--seed must be a non-negative integer, got: ${raw}`);
  }
  return n;
}

function safeOutputDir(userDir: string): string {
  const resolved = path.resolve(process.cwd(), userDir);
  const root = path.resolve(process.cwd());
  if (!resolved.startsWith(root + path.sep) && resolved !== root) {
    throw new Error(
      `output dir escapes working directory: ${userDir} → ${resolved}`
    );
  }
  return resolved;
}

const program = new Command();

program
  .name("ecofuzz")
  .description("economic attack simulation for DeFi protocols")
  .version("0.1.0");

// base58 alphabet, 32-44 chars — covers all Ed25519 pubkeys
const PUBKEY_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

program
  .command("scan <program-id>")
  .description("show generic DeFi attack surface checklist (heuristic, not on-chain)")
  .option("-r, --rpc <url>", "RPC endpoint", "https://api.devnet.solana.com")
  .action((programId, _opts) => {
    if (!PUBKEY_RE.test(programId)) {
      console.error(`error: '${programId}' is not a valid Solana program id (base58, 32-44 chars)`);
      process.exit(1);
    }
    console.log(chalk.bold(`\n  ecofuzz scan — ${programId}\n`));
    console.log(chalk.gray("  attack surface checklist (heuristic — runs the same set of checks against any program):"));
    console.log(chalk.gray("  " + "─".repeat(50)));
    console.log(`  ${chalk.red("HIGH")}   oracle dependency     — Pyth/Switchboard feed manipulation`);
    console.log(`  ${chalk.red("HIGH")}   flash loan exposure   — uncollateralized borrow vectors`);
    console.log(`  ${chalk.yellow("MED")}    sandwich surface      — AMM swap front/back-running`);
    console.log(`  ${chalk.yellow("MED")}    liquidation threshold — health factor edge cases`);
    console.log(`  ${chalk.blue("LOW")}    MEV opportunity       — priority fee sensitivity`);
    console.log(chalk.gray("  " + "─".repeat(50)));
    console.log(chalk.gray("  note: a deeper RPC-backed scan is on the roadmap; for now, see ecofuzz attack <scenario>"));
    console.log(`\n  ${chalk.gray("run")} ecofuzz attack <scenario.yaml> ${chalk.gray("to simulate")}`);
  });

program
  .command("attack <scenario-file>")
  .description("run YAML attack scenario against forked state")
  .option("-s, --seed <int>", "seed PRNG for reproducible runs")
  .action((file, opts) => {
    try {
      setSeed(parseSeed(opts.seed));
      const scenario = loadScenario(file);
      const errors = validateScenario(scenario);

      if (errors.length > 0) {
        console.error("scenario validation failed:");
        errors.forEach((e) => console.error(`  - ${e}`));
        process.exit(1);
      }

      console.log(chalk.bold(`\n  executing: ${scenario.name}`));
      console.log(chalk.gray(`  type: ${scenario.attack_type} | steps: ${scenario.attack_sequence.length}`));
      console.log(chalk.gray("  " + "─".repeat(50)));

      const result = executeAttack(scenario);

      // save result for report command
      const resultsDir = ".ecofuzz";
      fs.mkdirSync(resultsDir, { recursive: true });
      fs.writeFileSync(`${resultsDir}/last-attack.json`, JSON.stringify(result, null, 2));

      for (const step of result.steps) {
        const icon = step.success ? chalk.green("✓") : chalk.red("✗");
        console.log(`  ${icon} step ${step.step}: ${step.action}`);
        const p = step.output.profit;
        if (typeof p === "number" && Number.isFinite(p) && p !== 0) {
          console.log(`    ${chalk.yellow("profit:")} ${chalk.green(p.toFixed(2))}`);
        }
      }

      console.log(chalk.gray("  " + "─".repeat(50)));
      console.log(`  gross profit:   ${chalk.gray(result.grossProfit.toFixed(2))}`);
      console.log(`  tx cost:        ${chalk.gray("-" + result.txCostTotal.toFixed(2))}`);
      const profitColor = result.totalProfit > 0 ? chalk.red : chalk.green;
      console.log(`  net profit:     ${profitColor(result.totalProfit.toFixed(2))}`);
      console.log(`  invariants:     ${result.invariantsPassed}/${result.invariantsChecked} passed`);
      console.log(`  duration:       ${chalk.gray(result.duration + "ms")}`);
    } catch (e) {
      console.error(`error: ${e instanceof Error ? e.message : e}`);
      process.exit(1);
    }
  });

program
  .command("fuzz <scenario-file>")
  .description("genetic fuzzer — evolve attack parameters automatically")
  .option("-s, --seed <int>", "seed PRNG for reproducible runs")
  .action((file, opts) => {
    try {
      setSeed(parseSeed(opts.seed));
      const scenario = loadScenario(file);

      console.log(chalk.bold(`\n  genetic fuzzer — ${scenario.name}`));
      console.log(chalk.gray(`  strategy: ${scenario.fuzzer_config?.strategy || "genetic"} | pop: ${scenario.fuzzer_config?.population || 30} | gen: ${scenario.fuzzer_config?.generations || 50}`));
      console.log(chalk.gray("  " + "─".repeat(50)));

      const result = runGeneticFuzzer(scenario);

      // save for report
      const fuzzDir = ".ecofuzz";
      fs.mkdirSync(fuzzDir, { recursive: true });
      fs.writeFileSync(`${fuzzDir}/last-fuzz.json`, JSON.stringify(result, null, 2));

      console.log(chalk.bold("\n  results:"));
      console.log(chalk.gray("  " + "═".repeat(50)));
      console.log(`  generations:     ${chalk.white(String(result.generations))}`);
      console.log(`  total attacks:   ${chalk.white(String(result.totalAttacks))}`);
      console.log(`  profitable:      ${chalk.red(String(result.profitableAttacks))}`);
      console.log(`  best fitness:    ${chalk.yellow(result.bestFitness.toFixed(2))}`);
      console.log(chalk.gray("  best params:"));
      for (const [key, val] of Object.entries(result.bestParams)) {
        console.log(`    ${chalk.cyan(key)}: ${(val as number).toFixed(2)}`);
      }
      console.log(chalk.gray("  " + "═".repeat(50)));
    } catch (e) {
      console.error(`error: ${e instanceof Error ? e.message : e}`);
      process.exit(1);
    }
  });

program
  .command("report <output-dir>")
  .description("generate vulnerability report from last run")
  .action((dir) => {
    let outDir: string;
    try {
      outDir = safeOutputDir(dir);
    } catch (e) {
      console.error(`error: ${e instanceof Error ? e.message : e}`);
      process.exit(1);
    }
    fs.mkdirSync(outDir, { recursive: true });

    let attackData: AttackResult | null = null;
    let fuzzData: Record<string, unknown> | null = null;

    try {
      attackData = JSON.parse(fs.readFileSync(".ecofuzz/last-attack.json", "utf-8"));
    } catch (e) {
      const code = (e as NodeJS.ErrnoException).code;
      if (code !== "ENOENT") {
        console.warn(chalk.yellow(`  warn: could not read last-attack.json (${code || "parse error"})`));
      }
    }
    try {
      fuzzData = JSON.parse(fs.readFileSync(".ecofuzz/last-fuzz.json", "utf-8"));
    } catch (e) {
      const code = (e as NodeJS.ErrnoException).code;
      if (code !== "ENOENT") {
        console.warn(chalk.yellow(`  warn: could not read last-fuzz.json (${code || "parse error"})`));
      }
    }

    const findings: Array<Record<string, unknown>> = [];

    // severity buckets, in USD-equivalent profit. these are inputs to risk triage,
    // not absolute thresholds — adjust per protocol TVL when consuming the report.
    const SEV_CRITICAL_USD = 1000;
    const SEV_HIGH_USD = 100;
    const SEV_FUZZ_FITNESS_CRITICAL = 500;

    if (attackData) {
      const severity =
        attackData.totalProfit > SEV_CRITICAL_USD ? "CRITICAL" :
        attackData.totalProfit > SEV_HIGH_USD ? "HIGH" : "MEDIUM";
      findings.push({
        id: `ECOFUZZ-${String(findings.length + 1).padStart(3, "0")}`,
        severity,
        attack_type: attackData.attackType,
        scenario: attackData.scenario,
        estimated_loss: attackData.totalProfit,
        attack_steps: attackData.steps.length,
        invariants_broken: attackData.invariantsChecked - attackData.invariantsPassed,
      });
    }

    if (fuzzData) {
      const profitable = (fuzzData as Record<string, number>).profitableAttacks || 0;
      const bestFitness = (fuzzData as Record<string, number>).bestFitness || 0;
      if (profitable > 0) {
        findings.push({
          id: `ECOFUZZ-${String(findings.length + 1).padStart(3, "0")}`,
          severity: bestFitness > SEV_FUZZ_FITNESS_CRITICAL ? "CRITICAL" : "HIGH",
          attack_type: "genetic_fuzz",
          profitable_variants: profitable,
          best_fitness: bestFitness,
          best_params: (fuzzData as Record<string, unknown>).bestParams,
        });
      }
    }

    const report = {
      generated: new Date().toISOString(),
      tool: "ecofuzz",
      version: "0.1.0",
      total_findings: findings.length,
      critical: findings.filter((f) => f.severity === "CRITICAL").length,
      high: findings.filter((f) => f.severity === "HIGH").length,
      medium: findings.filter((f) => f.severity === "MEDIUM").length,
      findings,
    };

    const reportPath = path.join(outDir, "ecofuzz-report.json");
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

    // console output
    console.log(chalk.bold("\n  ecofuzz vulnerability report\n"));
    console.log(chalk.gray("  " + "═".repeat(50)));
    console.log(`  findings:   ${chalk.white(String(report.total_findings))}`);
    console.log(`  critical:   ${report.critical > 0 ? chalk.red(String(report.critical)) : chalk.green("0")}`);
    console.log(`  high:       ${report.high > 0 ? chalk.yellow(String(report.high)) : chalk.green("0")}`);
    console.log(`  medium:     ${chalk.white(String(report.medium))}`);
    console.log(chalk.gray("  " + "─".repeat(50)));

    for (const finding of findings) {
      const sevColor = finding.severity === "CRITICAL" ? chalk.red : finding.severity === "HIGH" ? chalk.yellow : chalk.blue;
      console.log(`\n  ${sevColor(`[${finding.severity}]`)} ${chalk.white(String(finding.id))}`);
      console.log(`  type: ${chalk.cyan(String(finding.attack_type))}`);
      if (finding.estimated_loss) {
        console.log(`  estimated loss: ${chalk.red("$" + String(finding.estimated_loss))}`);
      }
      if (finding.attack_steps) {
        console.log(`  attack path: ${chalk.gray(finding.attack_steps + " steps")}`);
      }
    }

    console.log(chalk.gray("\n  " + "═".repeat(50)));
    console.log(`  ${chalk.green("✓")} report saved: ${chalk.white(reportPath)}\n`);
  });

program.parse();

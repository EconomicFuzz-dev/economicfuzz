#!/usr/bin/env node
import { Command } from "commander";
import * as fs from "fs";
import { loadScenario, validateScenario } from "./core/scenario-parser";
import { executeAttack } from "./core/attack-executor";
import { runGeneticFuzzer } from "./core/genetic-fuzzer";

const program = new Command();

program
  .name("ecofuzz")
  .description("economic attack simulation for DeFi protocols")
  .version("0.1.0");

program
  .command("scan <program-id>")
  .description("scan a deployed program for economic vulnerabilities")
  .option("-r, --rpc <url>", "RPC endpoint", "https://api.devnet.solana.com")
  .action((programId, opts) => {
    console.log(`\nscanning ${programId} on ${opts.rpc}...\n`);
    console.log("attack surface analysis:");
    console.log("─".repeat(50));
    console.log("  oracle dependency     — check Pyth/Switchboard feeds");
    console.log("  flash loan exposure   — check for uncollateralized borrows");
    console.log("  sandwich surface      — check AMM swap instructions");
    console.log("  liquidation threshold — check health factor calcs");
    console.log("  MEV opportunity       — check priority fee sensitivity");
    console.log("─".repeat(50));
    console.log("\nrun 'ecofuzz attack <scenario.yaml>' to simulate attacks");
  });

program
  .command("attack <scenario-file>")
  .description("run YAML attack scenario against forked state")
  .action((file) => {
    try {
      const scenario = loadScenario(file);
      const errors = validateScenario(scenario);

      if (errors.length > 0) {
        console.error("scenario validation failed:");
        errors.forEach((e) => console.error(`  - ${e}`));
        process.exit(1);
      }

      console.log(`\nexecuting: ${scenario.name}`);
      console.log(`type: ${scenario.attack_type}`);
      console.log(`steps: ${scenario.attack_sequence.length}`);
      console.log("─".repeat(50));

      const result = executeAttack(scenario);

      for (const step of result.steps) {
        const icon = step.success ? "✓" : "✗";
        console.log(`  ${icon} step ${step.step}: ${step.action}`);
        if (step.output.profit) {
          console.log(`    profit: ${(step.output.profit as number).toFixed(2)}`);
        }
      }

      console.log("─".repeat(50));
      console.log(`total profit:     ${result.totalProfit.toFixed(2)}`);
      console.log(`invariants:       ${result.invariantsPassed}/${result.invariantsChecked} passed`);
      console.log(`duration:         ${result.duration}ms`);
    } catch (e) {
      console.error(`error: ${e instanceof Error ? e.message : e}`);
      process.exit(1);
    }
  });

program
  .command("fuzz <scenario-file>")
  .description("genetic fuzzer — evolve attack parameters automatically")
  .action((file) => {
    try {
      const scenario = loadScenario(file);

      console.log(`\nfuzzing: ${scenario.name}`);
      console.log(`strategy: ${scenario.fuzzer_config?.strategy || "genetic"}`);
      console.log(`population: ${scenario.fuzzer_config?.population || 30}`);
      console.log(`generations: ${scenario.fuzzer_config?.generations || 50}`);
      console.log("─".repeat(50));

      const result = runGeneticFuzzer(scenario);

      console.log(`\nresults:`);
      console.log("═".repeat(50));
      console.log(`generations:       ${result.generations}`);
      console.log(`total attacks:     ${result.totalAttacks}`);
      console.log(`profitable:        ${result.profitableAttacks}`);
      console.log(`best fitness:      ${result.bestFitness.toFixed(2)}`);
      console.log(`best params:`);
      for (const [key, val] of Object.entries(result.bestParams)) {
        console.log(`  ${key}: ${(val as number).toFixed(2)}`);
      }
      console.log("═".repeat(50));
    } catch (e) {
      console.error(`error: ${e instanceof Error ? e.message : e}`);
      process.exit(1);
    }
  });

program
  .command("report <output-dir>")
  .description("generate vulnerability report from last run")
  .action((dir) => {
    fs.mkdirSync(dir, { recursive: true });
    const reportPath = `${dir}/ecofuzz-report.json`;
    const report = {
      generated: new Date().toISOString(),
      tool: "ecofuzz",
      version: "0.1.0",
      findings: [],
      summary: "run 'ecofuzz attack' or 'ecofuzz fuzz' first to generate findings",
    };
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`report saved: ${reportPath}`);
  });

program.parse();

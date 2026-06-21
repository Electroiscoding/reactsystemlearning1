import "dotenv/config";
import { createInterface } from "node:readline";
import chalk from "chalk";
import { runAgent } from "./agent.js";

// ---- Get the task from CLI args or interactive prompt ----

async function getTask() {
  // If args were passed: node src/index.js "fix the bug in utils.js"
  const args = process.argv.slice(2).join(" ").trim();
  if (args) return args;

  // Otherwise, interactive prompt
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((res) => {
    console.log(chalk.cyan.bold("\n╔══════════════════════════════════════╗"));
    console.log(chalk.cyan.bold("║    🧠 ReAct SWE Agent               ║"));
    console.log(chalk.cyan.bold("╚══════════════════════════════════════╝\n"));
    rl.question(chalk.white.bold("What should I do? → "), (answer) => {
      rl.close();
      res(answer.trim());
    });
  });
}

// ---- Main ----

async function main() {
  const task = await getTask();

  if (!task) {
    console.log(chalk.red("No task provided. Exiting."));
    process.exit(1);
  }

  if (!process.env.API_KEY) {
    console.log(chalk.red("Missing API_KEY in your env/command line. Copy .env.example to .env and add your key."));
    process.exit(1);
  }

  try {
    await runAgent(task);
  } catch (err) {
    console.error(chalk.red(`\nFatal error: ${err.message}`));
    process.exit(1);
  }
}

main();

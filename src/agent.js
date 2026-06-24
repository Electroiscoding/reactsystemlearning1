// ============================================================
// agent.js — The ReAct loop orchestrator (the "brain")
// ============================================================
//
//   THINK  →  ACT  →  OBSERVE  →  repeat
//

import chalk from "chalk";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { callLLM, MODEL } from "./llm.js";
import { executeTool } from "./tools.js";
import { SYSTEM_PROMPT, TOOL_SCHEMAS } from "./prompts.js";
import { getMemoryContext, recordSession } from "./memory.js";

/**
 * Run the ReAct agentic loop.
 *
 * @param {string} task - The user's task description
 * @param {number} maxSteps - Max loop iterations (safety cap)
 * @returns {string} - The agent's final answer
 */
export async function runAgent(task, maxSteps) {
  const max = maxSteps || parseInt(process.env.MAX_STEPS) || 30;

  // Resolve active workspace directory
  const workdir = process.env.WORKDIR || process.cwd();
  const resolvedWorkdir = resolve(workdir);

  // Print a helpful warning if running nested without WORKDIR configured
  if (!process.env.WORKDIR) {
    const parentDir = resolve(process.cwd(), "..");
    const hasParentGit = existsSync(resolve(parentDir, ".git"));
    const hasParentPackage = existsSync(resolve(parentDir, "package.json"));
    if (parentDir !== process.cwd() && (hasParentGit || hasParentPackage)) {
      console.log(chalk.yellow.bold("\n⚠️  Note: You are running the agent inside a subdirectory."));
      console.log(chalk.yellow(`   If you want to target your parent project, add ${chalk.cyan("WORKDIR=../")} to your .env file.\n`));
    }
  }

  // Load memory from previous sessions
  const memoryContext = await getMemoryContext();

  // Dynamically inject workspace context into the system prompt
  const workspaceContext = `\n\n## ACTIVE WORKSPACE
Your active workspace directory is: ${resolvedWorkdir}
All tool operations (reading, writing, listing, grep, shell commands) are automatically executed relative to this folder.
Note: The agent's own code folder is completely hidden from your toolbox. You are operating strictly on the user's project codebase.`;

  const systemPrompt = SYSTEM_PROMPT + workspaceContext + memoryContext;

  // Initialize conversation with system prompt + user task
  const messages = [
    { role: "system", content: systemPrompt },
    { role: "user", content: task },
  ];

  // Track which tools are used this session (for memory)
  const toolsUsed = new Set();

  console.log(chalk.cyan.bold("\n🤖 Agent started\n"));
  console.log(chalk.dim(`   Model: ${MODEL}`));
  console.log(chalk.dim(`   Max steps: ${max}`));
  console.log(chalk.dim(`   Memory: ${memoryContext ? "loaded from previous sessions" : "no previous sessions"}`));
  console.log(chalk.dim(`   Task: ${task}\n`));
  console.log(chalk.dim("─".repeat(60)) + "\n");

  for (let step = 1; step <= max; step++) {
    console.log(chalk.yellow.bold(`⚡ Step ${step}/${max}`));

    // ---- 1. THINK + ACT: Ask the LLM what to do next ----
    let response;
    try {
      response = await callLLM(messages, TOOL_SCHEMAS);
    } catch (err) {
      console.log(chalk.red(`\n❌ LLM error: ${err.message}\n`));
      // Retry once on transient errors
      if (step < max) {
        console.log(chalk.yellow("   Retrying...\n"));
        continue;
      }
      return `Agent stopped due to LLM error: ${err.message}`;
    }

    // Add assistant message to history
    messages.push(response);

    // ---- 2. If the LLM responded with text (no tool calls) → done ----
    if (!response.tool_calls || response.tool_calls.length === 0) {
      const answer = response.content || "(no response)";
      console.log(chalk.green("\n💬 Agent response:\n"));
      console.log(answer);
      console.log(chalk.dim("\n" + "─".repeat(60)));
      console.log(chalk.green.bold("\n✅ Agent finished\n"));

      // Save to memory
      await recordSession(task, answer, [...toolsUsed]);

      return answer;
    }

    // ---- 3. OBSERVE: Execute each tool call ----
    // Show thinking if the model included text alongside tool calls
    if (response.content) {
      console.log(chalk.blue(`\n💭 Thinking: ${response.content}\n`));
    }

    for (const toolCall of response.tool_calls) {
      const { name, arguments: args } = toolCall.function;
      toolsUsed.add(name);

      // Log what tool is being called
      let argsPreview;
      try {
        const parsed = JSON.parse(args);
        argsPreview = Object.entries(parsed)
          .map(([k, v]) => {
            const val = typeof v === "string" && v.length > 80
              ? v.slice(0, 80) + "…"
              : v;
            return `${k}: ${JSON.stringify(val)}`;
          })
          .join(", ");
      } catch {
        argsPreview = args;
      }

      console.log(chalk.magenta(`   🔧 ${name}(${argsPreview})`));

      // Execute the tool
      const result = await executeTool(name, args);

      // Preview the result (truncated for console)
      const preview =
        result.length > 300
          ? result.slice(0, 300) + chalk.dim(`\n   ... (${result.length} chars total)`)
          : result;
      console.log(chalk.gray(`   📋 ${preview}\n`));

      // ---- 4. Feed observation back into the conversation ----
      messages.push({
        role: "tool",
        tool_call_id: toolCall.id,
        content: result,
      });
    }

    console.log(chalk.dim("─".repeat(60)) + "\n");
  }

  // Safety: max steps reached
  const msg = `⚠️  Agent hit the ${max}-step limit. Stopping to prevent infinite loops.`;
  console.log(chalk.red.bold(`\n${msg}\n`));

  // Save to memory even on timeout
  await recordSession(task, msg, [...toolsUsed]);

  return msg;
}

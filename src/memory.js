// ============================================================
// memory.js — Persistent memory across sessions (JSON file)
// ============================================================

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { resolve, dirname } from "node:path";

const MEMORY_FILE = resolve(process.cwd(), ".agent_memory.json");

/**
 * Load memory from disk. Returns { sessions: [], summary: "" }
 */
export async function loadMemory() {
  try {
    const raw = await readFile(MEMORY_FILE, "utf-8");
    return JSON.parse(raw);
  } catch {
    return { sessions: [], summary: "" };
  }
}

/**
 * Save memory to disk.
 */
export async function saveMemory(memory) {
  await mkdir(dirname(MEMORY_FILE), { recursive: true });
  await writeFile(MEMORY_FILE, JSON.stringify(memory, null, 2), "utf-8");
}

/**
 * Record a completed session into memory.
 * Keeps the last 10 sessions to avoid unbounded growth.
 */
export async function recordSession(task, result, toolsUsed) {
  const memory = await loadMemory();

  memory.sessions.push({
    timestamp: new Date().toISOString(),
    task,
    result: result.slice(0, 500), // keep summaries short
    toolsUsed,
  });

  // Keep only last 10 sessions
  if (memory.sessions.length > 10) {
    memory.sessions = memory.sessions.slice(-10);
  }

  // Build a running summary of what the agent knows
  memory.summary = memory.sessions
    .map((s, i) => `[${i + 1}] ${s.timestamp}: "${s.task}" → ${s.result.slice(0, 100)}`)
    .join("\n");

  await saveMemory(memory);
  return memory;
}

/**
 * Build a memory context string to inject into the system prompt.
 */
export async function getMemoryContext() {
  const memory = await loadMemory();

  if (memory.sessions.length === 0) return "";

  let ctx = "\n\n## MEMORY — Previous Sessions\n";
  ctx += "You have memory of previous tasks you completed. Use this context to be more helpful:\n\n";

  for (const session of memory.sessions) {
    ctx += `- **${session.timestamp}**: Task: "${session.task}"\n`;
    ctx += `  Result: ${session.result.slice(0, 200)}\n`;
    if (session.toolsUsed?.length) {
      ctx += `  Tools used: ${session.toolsUsed.join(", ")}\n`;
    }
    ctx += "\n";
  }

  return ctx;
}

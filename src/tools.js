// ============================================================
// tools.js — Tool implementations (the agent's "hands")
// ============================================================

import { readFile, writeFile, mkdir, readdir, stat } from "node:fs/promises";
import { exec } from "node:child_process";
import { resolve, relative, dirname } from "node:path";
import { createInterface } from "node:readline";

// Dangerous command patterns that require user confirmation
const DANGEROUS_PATTERNS = [
  "rm -rf",
  "rm -r",
  "sudo ",
  "kill ",
  "mkfs",
  "> /dev/",
  "dd if=",
  "chmod 777",
  ":(){",
  "format ",
];

// ---- Helpers ----

function getWorkdir() {
  return process.env.WORKDIR || process.cwd();
}

function resolvePath(p) {
  if (!p) return getWorkdir();
  return resolve(getWorkdir(), p);
}

function truncate(str, maxLen) {
  const max = maxLen || parseInt(process.env.MAX_OUTPUT_LENGTH) || 10000;
  if (str.length <= max) return str;
  const half = Math.floor(max / 2);
  return (
    str.slice(0, half) +
    `\n\n... [truncated ${str.length - max} characters] ...\n\n` +
    str.slice(-half)
  );
}

async function confirm(message) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((res) => {
    rl.question(`${message} (y/N): `, (answer) => {
      rl.close();
      res(answer.toLowerCase() === "y");
    });
  });
}

// ---- Tool Implementations ----

async function readFileTool({ path, start_line, end_line }) {
  const fullPath = resolvePath(path);
  const content = await readFile(fullPath, "utf-8");

  if (start_line || end_line) {
    const lines = content.split("\n");
    const start = (start_line || 1) - 1;
    const end = end_line || lines.length;
    const sliced = lines.slice(start, end);
    return sliced.map((line, i) => `${start + i + 1} | ${line}`).join("\n");
  }

  // Add line numbers
  return content
    .split("\n")
    .map((line, i) => `${i + 1} | ${line}`)
    .join("\n");
}

async function writeFileTool({ path, content }) {
  const fullPath = resolvePath(path);
  await mkdir(dirname(fullPath), { recursive: true });
  await writeFile(fullPath, content, "utf-8");
  return `✅ File written: ${path} (${content.length} bytes)`;
}

async function listDirTool({ path, recursive }) {
  const fullPath = resolvePath(path);
  const entries = [];

  async function walk(dir, depth = 0) {
    const items = await readdir(dir, { withFileTypes: true });
    for (const item of items) {
      // Skip node_modules and .git
      if (item.name === "node_modules" || item.name === ".git") continue;

      const itemPath = resolve(dir, item.name);
      const rel = relative(fullPath, itemPath);
      const prefix = "  ".repeat(depth);
      const isDir = item.isDirectory();

      if (isDir) {
        entries.push(`${prefix}📁 ${rel}/`);
        if (recursive) await walk(itemPath, depth + 1);
      } else {
        const info = await stat(itemPath);
        const size = info.size;
        const sizeStr =
          size > 1024
            ? `${(size / 1024).toFixed(1)}KB`
            : `${size}B`;
        entries.push(`${prefix}📄 ${rel} (${sizeStr})`);
      }
    }
  }

  await walk(fullPath);
  return entries.length > 0 ? entries.join("\n") : "(empty directory)";
}

async function runCommandTool({ command, cwd }) {
  const workdir = cwd ? resolvePath(cwd) : getWorkdir();

  // Safety check for dangerous commands
  const isDangerous = DANGEROUS_PATTERNS.some((p) =>
    command.toLowerCase().includes(p.toLowerCase())
  );
  if (isDangerous) {
    const allowed = await confirm(
      `⚠️  Potentially dangerous command:\n   ${command}\n   Allow execution?`
    );
    if (!allowed) return "❌ Command blocked by user.";
  }

  return new Promise((res) => {
    exec(
      command,
      { cwd: workdir, timeout: 30000, maxBuffer: 1024 * 1024 },
      (error, stdout, stderr) => {
        let output = "";
        if (stdout) output += stdout;
        if (stderr) output += (output ? "\n" : "") + "STDERR:\n" + stderr;
        if (error && !stderr) output += `ERROR: ${error.message}`;
        res(truncate(output || "(no output)"));
      }
    );
  });
}

async function grepSearchTool({ pattern, path, include }) {
  const fullPath = resolvePath(path);

  // Build grep command
  let cmd = `grep -rnI --color=never`;
  if (include) cmd += ` --include='${include}'`;
  cmd += ` '${pattern.replace(/'/g, "'\\''")}' '${fullPath}'`;

  return new Promise((res) => {
    exec(cmd, { maxBuffer: 1024 * 1024 }, (error, stdout) => {
      if (error && !stdout) {
        return res("No matches found.");
      }
      // Make paths relative for readability
      const result = stdout.replace(new RegExp(fullPath + "/", "g"), "");
      res(truncate(result || "No matches found."));
    });
  });
}

// ---- Registry ----

const TOOL_REGISTRY = {
  read_file: readFileTool,
  write_file: writeFileTool,
  list_dir: listDirTool,
  run_command: runCommandTool,
  grep_search: grepSearchTool,
};

/**
 * Execute a tool by name with parsed arguments.
 * Returns the tool output as a string.
 */
export async function executeTool(name, argsJson) {
  const fn = TOOL_REGISTRY[name];
  if (!fn) return `Unknown tool: ${name}`;

  try {
    const args = typeof argsJson === "string" ? JSON.parse(argsJson) : argsJson;
    return await fn(args);
  } catch (err) {
    return `Tool error (${name}): ${err.message}`;
  }
}

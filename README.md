<p align="center">
  <img src="logos/swades-clean-removebg-preview.png" width="120" alt="Swades Agent logo"/>
</p>

<h1 align="center">Swades Agent</h1>

<p align="center">
  Autonomous AI software engineering agent. ReAct loop. Terminal-native. OpenAI-compatible API.
</p>

---

## What it does

Swades Agent runs an agentic loop — **Thought → Tool Call → Observation → repeat** — until a coding task is complete. It reads your codebase, writes and patches files, runs shell commands, and searches code, all driven by any OpenAI-compatible LLM provider.

Tokens stream to the terminal as they arrive. No UI. No server. Just a Node.js process.

---

## Architecture

```
src/
  index.js      CLI entry point — reads task from args or stdin, triggers auto-index, dispatches to agent or director
  agent.js      ReAct loop — manages message history, streams LLM response, dispatches tool calls
  director.js   Director loop — supervises the worker agent across multiple cycles in 24/7 mode
  llm.js        Thin OpenAI-SDK wrapper — streaming-first, reconstructs full message from SSE deltas
  tools.js      7 tool implementations + heuristic syntax checker + codebase indexer
  prompts.js    System prompt (JSONL-structured) + tool schemas (OpenAI function-calling format)
  memory.js     Appends session summaries to .agent_memory.json, injects relevant past context
```

**Message flow (single run):**
```
index.js → index_codebase() → agent.js loop:
  [system + memory + task] → LLM (streaming)
    → text tokens → printed live
    → tool_call delta → executeTool() → observation → appended to messages
  repeat until LLM responds with no tool calls → done
```

**Message flow (24/7 mode `--autonomous`):**
```
director.js → cycle 1..N:
  runAgent(messages)         ← worker resolves a sub-task
  callLLM(directorMessages)  ← director reviews history, writes next prompt
  messages.push(nextPrompt)  ← appended as user turn
  repeat until director outputs "STATUS: COMPLETE"
```

---

## Requirements

- Node.js v18 or later
- An API key from any OpenAI-compatible provider (OpenAI, OpenRouter, Groq, Ollama, etc.)

---

## Setup

```bash
# 1. Clone
git clone https://github.com/Electroiscoding/reactsystemlearning1.git
cd reactsystemlearning1

# 2. Install dependencies (3 packages: openai, dotenv, chalk)
npm install

# 3. Configure
cp .env.example .env
# Edit .env and set your API_KEY, BASE_URL, and MODEL
```

### `.env` fields

| Variable | Required | Default | Description |
|---|---|---|---|
| `API_KEY` | Yes | — | Your provider API key |
| `BASE_URL` | No | `https://openrouter.ai/api/v1` | Provider base URL |
| `MODEL` | No | `openrouter/free` | Model identifier string |
| `MAX_STEPS` | No | `30` | Max tool-call iterations per agent run |
| `MAX_OUTPUT_LENGTH` | No | `10000` | Character cap on tool output fed back to LLM |
| `WORKDIR` | No | `process.cwd()` | Absolute or relative path the agent operates on |

**If you clone this repo inside another project** (e.g. `myproject/swades-agent/`), set `WORKDIR=../` in `.env` so the agent targets your project root, not its own folder.

---

## Running

### Single run (default)
```bash
# Interactive (task prompt + mode question)
npm start

# Direct task via argument
node src/index.js "Refactor the database module to use connection pooling"
```

### 24/7 autonomous mode
```bash
# Interactive
npm start  # answer Y to the autonomous mode question

# Direct
node src/index.js "Add a full test suite for the auth module and fix any failures" --autonomous
```

The `--autonomous` flag activates the Director loop. The Director AI reviews the accumulated conversation history after each worker run and writes the next task prompt on behalf of the user, iterating until it determines the goal is fully achieved.

---

## Tools

| Tool | Arguments | Description |
|---|---|---|
| `index_codebase` | _(none)_ | Scans workspace, writes `.agent_index.json` with file structure (imports, exports, classes, functions) |
| `read_file` | `path`, `start_line?`, `end_line?` | Returns file contents with line numbers. Supports partial reads. |
| `write_file` | `path`, `content` | Writes a new file. Runs syntax + indentation checks on save. |
| `patch_file` | `path`, `target`, `replacement` | Replaces a unique block within an existing file. Space-sensitive. Fails loudly if target is ambiguous or missing. |
| `list_dir` | `path`, `recursive?` | Lists directory tree. Skips `node_modules`, `.git`, and the agent's own folder. |
| `grep_search` | `pattern`, `path`, `include?` | Runs `grep -rnI` across the workspace. Excludes the agent directory. |
| `run_command` | `command`, `cwd?` | Executes a shell command with 30s timeout. Prompts user confirmation for destructive patterns. |

### Automatic checks on every write

`write_file` and `patch_file` both run static analysis immediately after writing:

- **Bracket matching**: detects unclosed `{`, `(`, `[` and mismatched pairs
- **Indentation consistency**: detects mixed tabs + spaces; flags sudden indentation jumps
- **JS/MJS/CJS**: runs `node --check <file>` for compiler-level syntax validation
- **JSON**: runs `JSON.parse()` on the content

Errors and warnings are returned as part of the tool output so the LLM can self-correct before running commands.

---

## Memory

After each completed run, `memory.js` appends a session record to `.agent_memory.json`:
```json
{
  "timestamp": "...",
  "task": "...",
  "summary": "...",
  "toolsUsed": ["read_file", "patch_file", "run_command"]
}
```

On the next run, the three most recent sessions are injected into the system prompt, giving the agent continuity across separate invocations.

---

## Safety

- **Dangerous commands** — `rm -rf`, `sudo`, `kill`, `dd if=`, etc. pause execution and require an explicit `y` from the terminal before running.
- **Step cap** — the worker agent stops after `MAX_STEPS` iterations (default 30) to prevent runaway loops.
- **Director cycle cap** — the director loop stops after 5 cycles by default (pass `maxCycles` to `runDirector()` to override).
- **Self-isolation** — when the agent is installed inside the workspace it operates on, it automatically excludes its own directory from `list_dir` and `grep_search` results so the LLM doesn't get confused by its own source files.
- **Workspace scoping** — all file paths passed to tools are resolved relative to `WORKDIR`, never escaping it via `..` traversal.

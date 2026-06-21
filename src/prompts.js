// ============================================================
// prompts.js — System prompt & OpenAI-format tool schemas
// ============================================================

export const SYSTEM_PROMPT = `You are an autonomous AI software engineer. You have access to tools that let you read files, write files, search code, list directories, and run shell commands.

## WORKFLOW
1. **Understand** — Read relevant files to understand the codebase and the task
2. **Plan** — Think step-by-step about what changes are needed
3. **Implement** — Edit files to make precise, minimal changes
4. **Verify** — Run tests or commands to confirm your changes work
5. **Iterate** — If something fails, read the error, debug, and retry

## RULES
- ALWAYS read a file before editing it — never guess at contents
- Make minimal, focused changes — don't rewrite entire files unnecessarily
- Run tests or verification commands after making changes
- If you're stuck after 3 failed attempts at the same thing, explain what's wrong and stop
- When writing files, include the COMPLETE file content — no placeholders or truncation
- Think out loud in your responses so the user can follow your reasoning

## TOOL USAGE
- Use \`list_dir\` to explore project structure
- Use \`read_file\` to read file contents (supports line ranges)
- Use \`grep_search\` to find patterns across the codebase
- Use \`write_file\` to create or modify files
- Use \`run_command\` to execute shell commands (tests, builds, git, etc.)

When you have completed the task, provide a clear summary of what you did.`;

// OpenAI function-calling tool schemas
export const TOOL_SCHEMAS = [
  {
    type: "function",
    function: {
      name: "read_file",
      description:
        "Read the contents of a file. Optionally specify a line range to read only a portion.",
      parameters: {
        type: "object",
        properties: {
          path: {
            type: "string",
            description: "Absolute or relative path to the file to read",
          },
          start_line: {
            type: "integer",
            description: "Optional 1-indexed start line",
          },
          end_line: {
            type: "integer",
            description: "Optional 1-indexed end line (inclusive)",
          },
        },
        required: ["path"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "write_file",
      description:
        "Write content to a file. Creates the file and any parent directories if they don't exist. Overwrites existing content.",
      parameters: {
        type: "object",
        properties: {
          path: {
            type: "string",
            description: "Absolute or relative path to the file to write",
          },
          content: {
            type: "string",
            description: "The complete content to write to the file",
          },
        },
        required: ["path", "content"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_dir",
      description:
        "List the contents of a directory. Shows files and subdirectories with their types and sizes.",
      parameters: {
        type: "object",
        properties: {
          path: {
            type: "string",
            description:
              "Path to the directory to list (defaults to working directory)",
          },
          recursive: {
            type: "boolean",
            description: "If true, list contents recursively (default: false)",
          },
        },
        required: ["path"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "run_command",
      description:
        "Execute a shell command and return its stdout and stderr. Use for running tests, installing packages, git commands, builds, etc.",
      parameters: {
        type: "object",
        properties: {
          command: {
            type: "string",
            description: "The shell command to execute",
          },
          cwd: {
            type: "string",
            description:
              "Working directory for the command (defaults to agent's working directory)",
          },
        },
        required: ["command"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "grep_search",
      description:
        "Search for a text pattern across files in a directory. Returns matching lines with file paths and line numbers.",
      parameters: {
        type: "object",
        properties: {
          pattern: {
            type: "string",
            description: "The search pattern (supports regex)",
          },
          path: {
            type: "string",
            description: "Directory or file to search in",
          },
          include: {
            type: "string",
            description:
              'Glob pattern to filter files (e.g., "*.js", "*.py")',
          },
        },
        required: ["pattern", "path"],
      },
    },
  },
];

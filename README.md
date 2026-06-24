# 🧠 ReAct SWE Agent

A lean, autonomous AI coding agent (~560 lines of code) that uses the **ReAct (Thought → Action → Observation)** loop to solve coding tasks inside your terminal. It reads files, edits code, searches patterns, and runs command-line commands to test its work.

---

## 🚀 Absolute Beginner's Guide (How to Setup & Run)

Follow these exact steps to get the agent running on your computer.

### Step 1: Check if you have Node.js installed
You need **Node.js** installed on your computer. 
* Open your Terminal (Mac/Linux) or Command Prompt (Windows).
* Type this command and press Enter:
  ```bash
  node -v
  ```
* If it prints a number like `v18.x.x` or `v22.x.x`, you are ready!
* If it says "command not found", download and install Node.js from [nodejs.org](https://nodejs.org/).

---

### Step 2: Download the Project
1. Open your terminal.
2. Clone this repository (or download it as a ZIP and extract it):
   ```bash
   git clone https://github.com/Electroiscoding/reactsystemlearning1.git
   ```
3. Enter the project folder:
   ```bash
   cd reactsystemlearning1
   ```

---

### Step 3: Install the Packages
Run the install command to get all required dependencies automatically:
```bash
npm install
```

---

### Step 4: Add your API Key
The agent needs an API Key to talk to the AI brain.
1. In the project folder, create a copy of the `.env.example` file and name it `.env`:
   * **On Mac/Linux, run:**
     ```bash
     cp .env.example .env
     ```
   * **On Windows, run:**
     ```cmd
     copy .env.example .env
     ```
2. Open this new `.env` file in your favorite text editor (like VS Code, Notepad, etc.).
3. Put your OpenRouter key next to `API_KEY=`. It should look like this:
   ```env
   API_KEY=sk-or-v1-xxxxxxxxxxxxxxxxxxxxxxxxx
   BASE_URL=https://openrouter.ai/api/v1
   MODEL=openrouter/owl-alpha
   ```
4. Save the file. (Note: `.env` is hidden by default and ignored by Git so your key stays 100% safe).

---

### Step 5: Run the Agent!

You can run the agent in **two different ways**:

#### Way A: Interactive Mode (Recommended)
Just type:
```bash
npm start
```
The screen will ask you: `What should I do? → `. Type your command, hit Enter, and watch the agent work!

#### Way B: Direct Mode
You can pass the task directly inside the command:
```bash
node src/index.js "Write a hello world function in JavaScript and save it to test.js"
```

---

## 💡 Example Tasks You Can Ask

Here are some real examples of what the agent can do for you:

* **Write code**: `"Create an index.js file with an Express server on port 3000"`
* **Read and explain**: `"Explore this project and explain what src/tools.js does"`
* **Find and replace**: `"Search for all instances of '2+2' in the codebase and change them to '4'"`
* **Debug and Fix**: `"Run node test.js, see why it's failing, and fix the bug"`

---

## 🛠 Tools in the Agent's Toolbox

The agent uses these tools automatically behind the scenes to interact with your codebase:

| Tool | What it does |
|------|-------------|
| **`read_file`** | Reads file contents (helps the agent study your code). |
| **`write_file`** | Writes/edits code files (helps the agent implement features). |
| **`list_dir`** | Shows files and folders in the workspace (ignores `node_modules` automatically). |
| **`grep_search`** | Searches for specific text patterns across all files. |
| **`run_command`** | Executes any terminal command (like `npm test`, `git log`, etc.). |

---

## 📂 How to use this on your own codebase

If you want the agent to work on a different project (your own repository):

### Option A: The Subfolder Way (Easiest)
1. Clone this repository into a folder called `agent` inside your own project:
   ```bash
   git clone https://github.com/Electroiscoding/reactsystemlearning1.git agent
   ```
2. Open the `agent/.env` file and add the `WORKDIR` variable pointing to your project (the parent folder):
   ```env
   API_KEY=your_openrouter_key
   BASE_URL=https://openrouter.ai/api/v1
   MODEL=openrouter/free
   WORKDIR=../
   ```
3. Run the agent inside the `agent` folder:
   ```bash
   cd agent && npm install && npm start
   ```

*Because `WORKDIR=../` is set, the agent will automatically read, write, and run commands in your parent project folder!*

---

### Option B: The Copy-Paste Way
Just copy the `src/` folder, `.env` file, and merge the dependencies in `package.json` directly into the root folder of your project. Then run:
```bash
node src/index.js "Find all bugs"
```

---

## 🔒 Safety & Guardrails
Because the agent can run commands on your terminal, we built in safety rails:
* **Workspace Isolation & Self-Hiding**: If you clone the agent into a subfolder (like `/agent`), the agent programmatically hides its own directory from its `list_dir` and `grep_search` tools. The AI never sees its own source code, preventing it from getting distracted or editing its own files.
* **Dangerous Commands**: If the agent tries to run a command containing `rm -rf`, `sudo`, `kill`, etc., it will stop and ask for your permission: `Allow execution? (y/N)`.
* **Timeout Limits**: Terminal commands automatically timeout after 30 seconds to prevent hanging.
* **Infinite Loop Prevention**: The agent will automatically stop after 30 steps if it gets stuck.

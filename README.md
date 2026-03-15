# MCP Test Generator

An [MCP](https://modelcontextprotocol.io/) (Model Context Protocol) server that **generates test cases** for your project. Supports TypeScript, JavaScript, Python, and Java. Works with Cursor, Claude Desktop, Google Antigravity Studio, and any MCP client.

**Note:** This tool only **generates** test files; it does not run them. Use your usual test runner (Jest, Vitest, pytest, etc.) to execute tests.

---

## Install

```bash
npm install -g mcp-test-generator
```

Or use without global install:

```bash
npx mcp-test-generator
```

---

## Configure your MCP client

Add the server to your client’s MCP config. Use **one** of the following.

### If installed globally

```json
{
  "mcpServers": {
    "mcp-test-generator": {
      "command": "mcp-test-generator"
    }
  }
}
```

### Using npx (no global install)

```json
{
  "mcpServers": {
    "mcp-test-generator": {
      "command": "npx",
      "args": ["-y", "mcp-test-generator"]
    }
  }
}
```

### Config file locations

- **Cursor:** `~/.cursor/mcp.json` (macOS/Linux) or `%USERPROFILE%\.cursor\mcp.json` (Windows)
- **Claude Desktop:** See [Claude MCP docs](https://docs.anthropic.com/en/docs/build-with-claude/mcp)
- **Other clients:** Check your client’s docs for “MCP” or “Model Context Protocol” configuration.

Restart (or reload) your client after changing the config.

---

## Tools

| Tool | Description |
|------|-------------|
| **`analyze_project`** | Analyzes a project and returns structure, language, framework, and testable files. Does not generate tests. |
| **`generate_single_test`** | Generates a test file for one source file. |
| **`generate_all_tests`** | Analyzes the project and generates test files for all testable source files. |

All paths must be **absolute** (e.g. `/Users/me/my-project` or `C:\Users\me\my-project`).

### Example usage (in chat)

- “Analyze the project at `/path/to/my-app`”
- “Generate a test for `/path/to/my-app/src/utils.ts`”
- “Generate tests for the whole project at `/path/to/my-app`”

---

## Build from source

If you prefer to run from the repo instead of npm:

```bash
git clone https://github.com/your-username/mcp-test-generator.git
cd mcp-test-generator
npm install
npm run build
```

Then point your MCP config at the built entrypoint:

```json
{
  "mcpServers": {
    "mcp-test-generator": {
      "command": "node",
      "args": ["/absolute/path/to/mcp-test-generator/dist/index.js"]
    }
  }
}
```

See [TESTING.md](./TESTING.md) for more detailed testing steps.

---

## Publish to npm (for maintainers)

1. Create an [npm account](https://www.npmjs.com/signup) if needed.
2. Log in: `npm login`
3. Update `repository.url` in `package.json` to your GitHub repo (e.g. `https://github.com/your-username/mcp-test-generator.git`).
4. Publish: `npm publish`

The `prepublishOnly` script runs `npm run build` automatically, so the published package includes the built `dist/` folder.

If the name `mcp-test-generator` is taken, use a scoped package: set `"name": "@your-username/mcp-test-generator"` and publish with `npm publish --access public`.

---

## License

MIT

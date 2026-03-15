# Testing the MCP Test Generator

For install and config, see the main [README.md](./README.md).

## 1. Build (if running from source)

```bash
npm run build
```

## 2. Test in Cursor (recommended)

The server talks over **stdio**, so Cursor (or any MCP client) can run it as a subprocess.

1. **Add the server to Cursor’s MCP config**
   - Open Cursor Settings → **MCP** (or edit the config file directly).
   - Config file is usually:
     - **macOS:** `~/.cursor/mcp.json`
     - **Windows:** `%USERPROFILE%\.cursor\mcp.json`
   - Add an entry for this server, for example:

   ```json
   {
     "mcpServers": {
       "mcp-test-generator": {
         "command": "node",
         "args": ["/Users/ranjatsrivastava/Documents/MCP Tools/mcp-test-generator/dist/index.js"]
       }
     }
   }
   ```

   Use the **absolute path** to `dist/index.js` in your project.

2. **Restart Cursor** (or reload the window) so it picks up the new MCP server.

3. **Use the tools**
   - In a Cursor chat, the model can call:
     - **`analyze_project`** – `{ "projectPath": "/absolute/path/to/your/project" }`
     - **`generate_single_test`** – `{ "filePath": "/absolute/path/to/source/file.ts" }`
     - **`generate_all_tests`** – `{ "projectPath": "/absolute/path/to/your/project" }`
   - You can ask things like:
     - “Analyze the project at …”
     - “Generate a test for …”
     - “Generate tests for the whole project at …”

## 3. Quick sanity check (optional)

Run the server and confirm it starts (it will wait for JSON-RPC on stdin):

```bash
npm run start
```

You should see (on stderr):

```
MCP Test Generator Server running on stdio
```

Then press **Ctrl+C** to stop. If that runs without errors, the server binary is fine.

## 4. Test with another MCP client

If you use the MCP inspector or another client:

- **Command:** `node dist/index.js` (from the project root, or use the full path to `dist/index.js`).
- **Transport:** stdio (default for this server).

Then call the tools by name with the arguments above.

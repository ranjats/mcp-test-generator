#!/usr/bin/env node

import { createMCPServer } from "./server.js";

async function main() {
  const server = createMCPServer();
  
  const transport = await import("@modelcontextprotocol/sdk/server/stdio.js");
  const stdioTransport = new transport.StdioServerTransport();
  
  await server.connect(stdioTransport);
  console.error("MCP Test Generator Server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
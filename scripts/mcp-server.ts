#!/usr/bin/env node
// Local MCP server that lets Claude Code read and manage your contacts.
// Registered in .mcp.json; to run by hand: npx tsx --env-file=.env scripts/mcp-server.ts
// Needs KV_REST_API_URL, KV_REST_API_TOKEN and NEXTCONNECTION_USER_ID in .env.
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerContactTools } from "@/lib/mcp/tools";

// stdout carries the MCP protocol, so all diagnostics go to stderr.
const missing = ["KV_REST_API_URL", "KV_REST_API_TOKEN", "NEXTCONNECTION_USER_ID"].filter(
  (name) => !process.env[name]
);
if (missing.length) {
  console.error(
    `Missing ${missing.join(", ")}.\nAdd them to .env (NEXTCONNECTION_USER_ID is printed by scripts/create-admin.mjs).`
  );
  process.exit(1);
}

const server = new McpServer({ name: "nextconnection", version: "0.1.0" });
registerContactTools(server, process.env.NEXTCONNECTION_USER_ID!);

server
  .connect(new StdioServerTransport())
  .then(() => console.error("nextconnection MCP server running on stdio"))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });

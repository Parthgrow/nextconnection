import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { requireMcpUserId } from "@/lib/mcp/auth";
import { registerContactTools } from "@/lib/mcp/tools";

// Remote MCP endpoint (Streamable HTTP, stateless). proxy.ts skips /api, so
// this route authenticates itself with a per-user bearer token from /settings.
// A fresh server per request keeps it serverless-friendly: no sessions to
// share between instances.
export async function POST(req: Request) {
  const userId = await requireMcpUserId(req);
  if (userId instanceof Response) return userId;

  const server = new McpServer({ name: "nextconnection", version: "0.1.0" });
  registerContactTools(server, userId);

  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });
  await server.connect(transport);
  return transport.handleRequest(req);
}

// Stateless: no server-initiated SSE stream and no session to delete.
function methodNotAllowed() {
  return Response.json(
    { jsonrpc: "2.0", error: { code: -32000, message: "Method not allowed." }, id: null },
    { status: 405, headers: { Allow: "POST" } }
  );
}

export { methodNotAllowed as GET, methodNotAllowed as DELETE };

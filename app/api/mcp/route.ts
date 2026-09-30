import { requireMcpUserId } from "@/lib/mcp/auth";
import { handleMcpRequest, methodNotAllowed } from "@/lib/mcp/http";

// Remote MCP endpoint for clients that can send a header (e.g. Claude Code).
// proxy.ts skips /api, so this route authenticates itself with a per-user
// bearer token from /settings.
export async function POST(req: Request) {
  const userId = await requireMcpUserId(req);
  if (userId instanceof Response) return userId;
  return handleMcpRequest(req, userId);
}

export { methodNotAllowed as GET, methodNotAllowed as DELETE };

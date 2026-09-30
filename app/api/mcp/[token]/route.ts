import { requireMcpUserIdFromPath } from "@/lib/mcp/auth";
import { handleMcpRequest, methodNotAllowed } from "@/lib/mcp/http";

// Remote MCP endpoint with the token in the URL, for claude.ai custom
// connectors, which only take a URL. The URL is the credential: anyone who
// has it has full access until the token is revoked at /settings.
export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const userId = await requireMcpUserIdFromPath(token);
  if (userId instanceof Response) return userId;
  return handleMcpRequest(req, userId);
}

export { methodNotAllowed as GET, methodNotAllowed as DELETE };

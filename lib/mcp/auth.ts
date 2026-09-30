import "server-only";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { kv } from "@vercel/kv";
import { mcpTokenIndexKey, mcpTokenKey } from "@/lib/kv-keys";

// Per-user bearer tokens for the remote MCP endpoint (app/api/mcp).
// The raw token is returned exactly once from createMcpToken; KV only ever
// holds its SHA-256, so a KV leak doesn't leak usable tokens.
//
//   nextconnection:mcp-token:<sha256>          → { userId, tokenId }
//   nextconnection:user:<userId>:mcp_tokens    → hash of tokenId → McpTokenInfo

export const MAX_TOKENS_PER_USER = 10;
const TOKEN_PREFIX = "nc_";

export type McpTokenInfo = {
  id: string;
  name: string;
  // First few characters of the raw token, so the user can tell tokens apart.
  hint: string;
  hash: string;
  createdAt: number;
};

type TokenRecord = { userId: string; tokenId: string };

export class TooManyTokensError extends Error {}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function listMcpTokens(userId: string): Promise<McpTokenInfo[]> {
  const all = await kv.hgetall<Record<string, McpTokenInfo>>(mcpTokenIndexKey(userId));
  return Object.values(all ?? {}).sort((a, b) => b.createdAt - a.createdAt);
}

export async function createMcpToken(userId: string, name: string): Promise<string> {
  if ((await kv.hlen(mcpTokenIndexKey(userId))) >= MAX_TOKENS_PER_USER) {
    throw new TooManyTokensError(
      `You can have at most ${MAX_TOKENS_PER_USER} tokens. Revoke one first.`
    );
  }

  const token = TOKEN_PREFIX + randomBytes(32).toString("base64url");
  const hash = hashToken(token);
  const info: McpTokenInfo = {
    id: randomUUID(),
    name,
    hint: token.slice(0, TOKEN_PREFIX.length + 6),
    hash,
    createdAt: Date.now(),
  };

  await Promise.all([
    kv.set<TokenRecord>(mcpTokenKey(hash), { userId, tokenId: info.id }),
    kv.hset(mcpTokenIndexKey(userId), { [info.id]: info }),
  ]);
  return token;
}

export async function revokeMcpToken(userId: string, tokenId: string): Promise<void> {
  const info = await kv.hget<McpTokenInfo>(mcpTokenIndexKey(userId), tokenId);
  if (!info) return;
  await Promise.all([
    kv.del(mcpTokenKey(info.hash)),
    kv.hdel(mcpTokenIndexKey(userId), tokenId),
  ]);
}

// For Route Handlers: resolves `Authorization: Bearer <token>` to a userId,
// or returns a 401 Response. Same calling convention as requireUserId().
export async function requireMcpUserId(req: Request): Promise<string | Response> {
  const match = req.headers.get("authorization")?.match(/^Bearer\s+(\S+)$/i);
  const record = match?.[1].startsWith(TOKEN_PREFIX)
    ? await kv.get<TokenRecord>(mcpTokenKey(hashToken(match[1])))
    : null;

  if (!record) {
    return Response.json(
      { error: "Missing or invalid MCP token. Generate one at /settings." },
      { status: 401, headers: { "WWW-Authenticate": 'Bearer realm="nextconnection"' } }
    );
  }
  return record.userId;
}

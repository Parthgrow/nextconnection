export function userKey(userId: string): string {
  return `nextconnection:user:${userId}`;
}

export function userByEmailKey(email: string): string {
  return `nextconnection:user:by-email:${email.trim().toLowerCase()}`;
}

export function accountKey(providerId: string, userId: string): string {
  return `nextconnection:account:${providerId}:${userId}`;
}

export function contactKey(userId: string, contactId: string): string {
  return `nextconnection:user:${userId}:contact:${contactId}`;
}

export function contactIndexKey(userId: string): string {
  return `nextconnection:user:${userId}:contact_ids`;
}

// Remote MCP API tokens: only the SHA-256 of a token is ever stored.
export function mcpTokenKey(tokenHash: string): string {
  return `nextconnection:mcp-token:${tokenHash}`;
}

export function mcpTokenIndexKey(userId: string): string {
  return `nextconnection:user:${userId}:mcp_tokens`;
}

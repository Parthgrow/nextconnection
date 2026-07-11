export type AuthUser = {
  id: string;
  email: string;
  name?: string;
};

// Shared by every provider, regardless of how it establishes identity.
export type AuthProvider = {
  id: string;
};

// Password-style: a single verify() call against submitted credentials.
export type CredentialsProvider = AuthProvider & {
  verify(input: { email: string; password: string }): Promise<AuthUser | null>;
};

// Future shape for Google/OAuth-style providers — a redirect + callback
// flow, not a synchronous verify(), so it gets its own interface.
export type OAuthProvider = AuthProvider & {
  getAuthorizationUrl(state: string): string;
  handleCallback(code: string): Promise<AuthUser | null>;
};

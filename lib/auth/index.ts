import "server-only";
import { credentialsProvider } from "@/lib/auth/credentials-provider";
import type { AuthUser } from "@/lib/auth/types";

const providers = {
  credentials: credentialsProvider,
  // google: googleProvider, // add here once implemented — nothing else changes
};

export async function signIn(
  providerId: keyof typeof providers,
  input: { email: string; password: string }
): Promise<AuthUser | null> {
  return providers[providerId].verify(input);
}

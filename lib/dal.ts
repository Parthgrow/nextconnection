import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";

// For Server Components / pages: redirects to /login if there's no valid session.
export const verifySession = cache(async () => {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }
  return session;
});

// For Route Handlers: a redirect doesn't make sense for a fetch() caller,
// so this returns a 401 Response instead. Callers should check
// `if (userId instanceof Response) return userId;` before using it.
export async function requireUserId(): Promise<string | Response> {
  const session = await getSession();
  if (!session) {
    return new Response(null, { status: 401 });
  }
  return session.userId;
}

import { cookies } from "next/headers";
import { randomUUID } from "node:crypto";

export const USER_COOKIE = "nc_uid";

// One year, since this cookie is the only thing identifying a browser's data until real auth exists.
const USER_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export async function getUserId(): Promise<string> {
  const cookieStore = await cookies();
  const existing = cookieStore.get(USER_COOKIE)?.value;
  if (existing) return existing;

  const userId = randomUUID();
  cookieStore.set(USER_COOKIE, userId, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: USER_COOKIE_MAX_AGE,
  });
  return userId;
}

// Single shared access code, checked in middleware. No accounts, no email flow.
// The cookie holds an HMAC of the code so the code itself is never stored client-side.

export const COOKIE = "jfx_portal";

async function hmac(value: string, secret: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(value));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function sessionToken(): Promise<string | null> {
  const pw = process.env.SITE_PASSWORD;
  if (!pw) return null;
  return hmac("jenfox-team-portal", pw);
}

export async function passwordMatches(input: string): Promise<boolean> {
  const pw = process.env.SITE_PASSWORD;
  if (!pw) return false;
  const a = await hmac(input, pw);
  const b = await hmac(pw, pw);
  return a === b;
}

/** Key for the treasurer calendar feed. Calendar apps can't send the cookie, so the feed URL
 *  carries this instead. It changes whenever SITE_PASSWORD changes, which revokes old links. */
export async function calendarToken(): Promise<string | null> {
  const pw = process.env.SITE_PASSWORD;
  if (!pw) return null;
  return (await hmac("jenfox-treasurer-calendar", pw)).slice(0, 32);
}

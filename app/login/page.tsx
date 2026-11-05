import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { COOKIE, passwordMatches, sessionToken } from "@/lib/auth";

export const dynamic = "force-dynamic";

async function login(formData: FormData) {
  "use server";
  const pw = String(formData.get("password") || "");
  const next = String(formData.get("next") || "/");
  if (await passwordMatches(pw)) {
    const token = await sessionToken();
    const jar = await cookies();
    jar.set(COOKIE, token || "", { httpOnly: true, sameSite: "lax", secure: true, path: "/", maxAge: 60 * 60 * 24 * 90 });
    redirect(next.startsWith("/") ? next : "/");
  }
  redirect(`/login?err=1&next=${encodeURIComponent(next)}`);
}

async function logout() {
  "use server";
  const jar = await cookies();
  jar.delete(COOKIE);
  redirect("/login");
}

export default async function LoginPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const configured = Boolean(process.env.SITE_PASSWORD);
  if (sp.out) {
    return (
      <div className="login">
        <form action={logout} className="box">
          <h2>Sign out?</h2>
          <button className="btn" type="submit">Sign out</button>
        </form>
      </div>
    );
  }
  return (
    <div className="login">
      <form action={login} className="box">
        <div className="logo login-logo">
          <span className="wm-k">Team site</span>
          <span className="wm">Jen Fox<br />for House</span>
        </div>
        {!configured && (
          <p className="notice err small">SITE_PASSWORD is not set on this deployment, so nobody can sign in yet.</p>
        )}
        {sp.err && <p className="notice err small">That access code did not match.</p>}
        <input type="hidden" name="next" value={sp.next || "/"} />
        <label style={{ display: "grid", gap: 6, marginBottom: 12 }}>
          <span className="small muted">Access code</span>
          <input name="password" type="password" autoFocus style={{ font: "inherit", padding: "9px 10px", border: "1px solid #ddd" }} />
        </label>
        <button className="btn" type="submit" style={{ width: "100%" }}>Enter</button>
      </form>
    </div>
  );
}

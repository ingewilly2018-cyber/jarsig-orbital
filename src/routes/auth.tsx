import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { HalftoneSphere } from "@/components/HalftoneSphere";
import { syncMyDatabaseAccount } from "@/lib/database.functions";

export const Route = createFileRoute("/auth")({
  head: () => ({ meta: [{ title: "Sign in — JARSIG" }, { name: "description", content: "Sign in or create a JARSIG account." }] }),
  component: AuthPage,
});

const G = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="#4285F4" d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z"/><path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09C3.26 21.3 7.31 24 12 24z"/><path fill="#FBBC05" d="M5.27 14.29c-.25-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.98-3.09z"/><path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.98 3.09c.95-2.85 3.6-4.96 6.73-4.96z"/></svg>`;

function authError(error: unknown) {
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object" && "message" in error) return String(error.message);
  return "Authentication could not be completed. Please try again.";
}

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function continueWithAccount() {
    const { data } = await supabase.auth.getSession();
    if (!data.session) return;
    const account = await syncMyDatabaseAccount();
    if (!account.active) {
      await supabase.auth.signOut();
      throw new Error("This account is disabled. Contact an administrator.");
    }
    await navigate({ to: account.passwordChangeRequired ? "/change-password" : "/play" });
  }

  useEffect(() => {
    let active = true;
    void continueWithAccount().catch((error) => { if (active) setMsg(authError(error)); });
    return () => { active = false; };
  }, []);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true); setMsg(null);
    try {
      if (mode === "up") {
        const { data, error } = await supabase.auth.signUp({ email: email.trim(), password, options: { emailRedirectTo: `${window.location.origin}/auth` } });
        if (error) throw error;
        if (data.session) await continueWithAccount();
        else setMsg("Account created. Check your email to confirm it, then sign in.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error) throw error;
        await continueWithAccount();
      }
    } catch (error) { setMsg(authError(error)); }
    finally { setBusy(false); }
  }

  async function signInWithGoogle() {
    setBusy(true); setMsg(null);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: `${window.location.origin}/auth`, queryParams: { prompt: "select_account" } },
      });
      if (error) throw error;
    } catch (error) { setMsg(authError(error)); setBusy(false); }
  }

  const input = "w-full border border-border bg-transparent px-4 py-3 text-sm outline-none focus:border-glow";
  return (
    <main className="grid min-h-screen items-center gap-12 bg-background px-6 py-12 font-sans text-foreground md:grid-cols-2">
      <HalftoneSphere className="hidden w-full max-w-lg justify-self-center md:block" />
      <div className="mx-auto w-full max-w-sm">
        <Link to="/" className="text-poster block text-center text-5xl">JARSIG</Link>
        <p className="mt-3 text-center text-xs uppercase tracking-[0.3em] text-muted-foreground">{mode === "in" ? "Sign in to fly" : "Create your pilot account"}</p>
        <div className="mt-10 space-y-3">
          <button type="button" disabled={busy} onClick={() => void signInWithGoogle()} className="flex w-full items-center justify-center gap-[10px] border border-[#8E918F] bg-[#131314] px-3 py-3 text-sm font-medium text-[#E3E3E3] disabled:opacity-50">
            <span aria-hidden="true" className="h-[18px] w-[18px]" dangerouslySetInnerHTML={{ __html: G }} />Continue with Google
          </button>
        </div>
        <div className="my-6 text-center text-xs text-muted-foreground">or</div>
        <form onSubmit={submit} className="space-y-3">
          <input className={input} type="email" autoComplete="email" required placeholder="Email" value={email} onChange={(event) => setEmail(event.target.value)} />
          <input className={input} type="password" autoComplete={mode === "in" ? "current-password" : "new-password"} required minLength={6} placeholder="Password" value={password} onChange={(event) => setPassword(event.target.value)} />
          <button disabled={busy} className="w-full border border-foreground py-3 text-xs uppercase tracking-widest transition-colors hover:bg-foreground hover:text-background disabled:opacity-50">{busy ? "Please wait…" : mode === "in" ? "Sign in" : "Sign up"}</button>
        </form>
        {msg && <p className="mt-4 text-center text-sm text-muted-foreground" role="alert">{msg}</p>}
        <button onClick={() => { setMode(mode === "in" ? "up" : "in"); setMsg(null); }} className="mt-6 w-full text-center text-xs text-muted-foreground hover:text-foreground">{mode === "in" ? "No account? Sign up" : "Have an account? Sign in"}</button>
      </div>
    </main>
  );
}

import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { completeInitialPasswordChange } from "@/lib/database.functions";

export const Route = createFileRoute("/_authenticated/change-password")({ component: ChangePasswordPage });

function ChangePasswordPage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault(); setMessage("");
    if (password.length < 12) { setMessage("Use at least 12 characters for the new password."); return; }
    if (password !== confirmation) { setMessage("The passwords do not match."); return; }
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    if (error) setMessage(error.message);
    else {
      try { await completeInitialPasswordChange(); await navigate({ to: "/play" }); }
      catch (err) { setMessage(err instanceof Error ? err.message : "Could not complete the password change."); }
    }
    setBusy(false);
  }

  const input = "w-full border border-border bg-transparent px-4 py-3 text-sm outline-none focus:border-glow";
  return (
    <main className="grid min-h-[80vh] place-items-center bg-background px-6 py-12 text-foreground">
      <form onSubmit={submit} className="w-full max-w-md space-y-4 border border-border p-7">
        <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Account security</p>
        <h1 className="text-poster text-4xl">Change your initial password</h1>
        <p className="text-sm text-muted-foreground">Choose a new password before continuing.</p>
        <input className={input} type="password" required autoComplete="new-password" placeholder="New password" value={password} onChange={(event) => setPassword(event.target.value)} />
        <input className={input} type="password" required autoComplete="new-password" placeholder="Confirm new password" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} />
        {message && <p className="text-sm text-muted-foreground" role="alert">{message}</p>}
        <button disabled={busy} className="w-full border border-foreground py-3 text-xs uppercase tracking-widest hover:bg-foreground hover:text-background disabled:opacity-50">{busy ? "Saving…" : "Change password"}</button>
      </form>
    </main>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

export default function LoginPage() {
  const router = useRouter();
  const supabase = createSupabaseBrowserClient();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({ email, password });

    setLoading(false);

    if (error) return setErr(error.message);

    router.push("/app/campaigns");
    router.refresh();
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <form onSubmit={onSubmit} className="w-full max-w-sm space-y-4 border rounded-xl p-6">
        <h1 className="text-xl font-semibold">Log in</h1>

        <label className="block space-y-1">
          <span className="text-sm">Email</span>
          <input
            className="w-full border rounded-md p-2"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            type="email"
            autoComplete="email"
            required
          />
        </label>

        <label className="block space-y-1">
          <span className="text-sm">Password</span>
          <input
            className="w-full border rounded-md p-2"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            type="password"
            autoComplete="current-password"
            required
          />
        </label>

        {err && <p className="text-sm text-red-600">{err}</p>}

        <button className="w-full rounded-md border p-2 font-medium" disabled={loading} type="submit">
          {loading ? "Logging in…" : "Log in"}
        </button>
      </form>
    </main>
  );
}

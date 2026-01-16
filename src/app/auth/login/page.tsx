"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import React, { Suspense, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import styles from "./login.module.css";

const BG_IMAGE_SRC = "/landing/hogwarts-like-castle.jpg";
const LETTER_IMAGE_SRC = "/landing/acceptance-letter.png";

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginFallback />}>
      <LoginInner />
    </Suspense>
  );
}

function LoginFallback() {
  // A simple fallback UI while search params are resolving during prerender/CSR bailout.
  return (
    <main className={styles.stage}>
      <div className={styles.bg} aria-hidden="true">
        <Image src={BG_IMAGE_SRC} alt="" fill priority className={styles.bgImg} />
        <div className={styles.bgVignette} />
      </div>

      <div className={styles.sparkles} aria-hidden="true" />

      <div className={styles.content}>
        <form className={styles.formCard}>
          <h1 className={styles.h1}>Log in</h1>
          <p style={{ opacity: 0.85, fontSize: 14, margin: 0 }}>Loading…</p>

          <div className={styles.back}>
            <Link href="/">← Back</Link>
          </div>
        </form>
      </div>
    </main>
  );
}

function LoginInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createSupabaseBrowserClient();

  const fromLanding = searchParams.get("from") === "landing";

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
    <main className={styles.stage}>
      <div className={styles.bg} aria-hidden="true">
        <Image src={BG_IMAGE_SRC} alt="" fill priority className={styles.bgImg} />
        <div className={styles.bgVignette} />
      </div>

      <div className={styles.sparkles} aria-hidden="true" />

      <div className={styles.content}>
        {fromLanding && (
          <div className={styles.letterBg} aria-hidden="true">
            <img src={LETTER_IMAGE_SRC} alt="" className={styles.letterBgImg} />
          </div>
        )}

        <form onSubmit={onSubmit} className={styles.formCard}>
          <h1 className={styles.h1}>Log in</h1>

          <label className={styles.label}>
            <span>Email</span>
            <input
              className={styles.input}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              autoComplete="email"
              required
            />
          </label>

          <label className={styles.label}>
            <span>Password</span>
            <input
              className={styles.input}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type="password"
              autoComplete="current-password"
              required
            />
          </label>

          {err && <p className={styles.err}>{err}</p>}

          <button className={styles.btn} disabled={loading} type="submit">
            {loading ? "Logging in…" : "Log in"}
          </button>

          <div className={styles.back}>
            <Link href="/">← Back</Link>
          </div>
        </form>
      </div>
    </main>
  );
}

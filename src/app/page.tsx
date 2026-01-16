"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import styles from "./page.module.css";

const HUB_URL = "https://dolodev.tech";
const BG_IMAGE_SRC = "/landing/hogwarts-like-castle.jpg";
const LETTER_IMAGE_SRC = "/landing/acceptance-letter.png";
const LETTER_SMALL_IMAGE_SRC = "/landing/small-acceptance-letter.png";

export default function Home() {
  const router = useRouter();

  const [ready, setReady] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    // Force the browser to paint once before starting intro animations
    const t = window.setTimeout(() => setReady(true), 250);
    return () => window.clearTimeout(t);
  }, []);

  function goToLogin() {
    if (leaving) return;
    setLeaving(true);

    // Let the slide animation be visible before route change
    timerRef.current = window.setTimeout(() => {
      router.push("/auth/login?from=landing");
    }, 1400);
  }

  useEffect(() => {
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, []);

  return (
    <main
      className={[
        styles.stage,
        ready ? styles.ready : "",
        leaving ? styles.leaving : "",
      ].join(" ")}
    >
      {/* Top-right hub button */}
      <div className={styles.hubBtn}>
        <a href={HUB_URL} target="_blank" rel="noreferrer">
          ⟵ Back to hub
        </a>
      </div>

      {/* Background */}
      <div className={styles.bg} aria-hidden="true">
        <Image src={BG_IMAGE_SRC} alt="" fill priority className={styles.bgImg} />
        <div className={styles.bgVignette} />
        {/* Guarantees "black -> dark" on entry */}
        <div className={styles.blackFade} />
      </div>

      {/* Sparkles overlay */}
      <div className={styles.sparkles} aria-hidden="true" />

      {/* Letter overlay (only animates in on leaving) */}
      <div className={styles.letterOverlay} aria-hidden="true">
        <img src={LETTER_IMAGE_SRC} alt="" className={styles.letterImg} />
      </div>

      {/* Content */}
      <div className={styles.content}>
        <section className={styles.card}>
          <h1 className={styles.title}>WWRPG</h1>

          <p className={styles.tagline}>
            Your Wizarding World tabletop companion — campaigns, characters, combat decks, and DM tools.
          </p>

          <div className={styles.actions}>
            <button className={styles.primaryBtn} onClick={goToLogin}>
              <img
                src={LETTER_SMALL_IMAGE_SRC}
                alt=""
                className={styles.letterMiniImg}
                aria-hidden="true"
              />
              <span>Enter (Login)</span>
            </button>
          </div>
        </section>
      </div>
    </main>
  );
}

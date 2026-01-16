"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import styles from "./page.module.css";

const HUB_URL = "https://dolodev.tech";
const BG_IMAGE_SRC = "/landing/hogwarts-like-castle.jpg";
const LETTER_IMAGE_SRC = "/landing/acceptance-letter.png";
const LETTER_SMALL_IMAGE_SRC = "/landing/small-acceptance-letter.png";

type Phase = 0 | 1 | 2 | 3 | 4;

export default function Home() {
  const router = useRouter();

  const [phase, setPhase] = useState<Phase>(0);
  const [leaving, setLeaving] = useState(false);

  const timersRef = useRef<number[]>([]);
  const navFallbackRef = useRef<number | null>(null);

  useEffect(() => {
    // Cleanup helper
    const clearAll = () => {
      timersRef.current.forEach((t) => window.clearTimeout(t));
      timersRef.current = [];
      if (navFallbackRef.current) window.clearTimeout(navFallbackRef.current);
      navFallbackRef.current = null;
    };

    clearAll();
    setLeaving(false);
    setPhase(0);

    // Kick animations after first paint
    timersRef.current.push(
      window.setTimeout(() => setPhase(1), 50),
      window.setTimeout(() => setPhase(2), 900),
      window.setTimeout(() => setPhase(3), 1250),
      window.setTimeout(() => setPhase(4), 1550)
    );

    return clearAll;
  }, []);

  function goToLogin() {
    if (leaving) return;
    setLeaving(true);

    // Fallback in case transitionend doesn't fire (e.g. weird browser edge cases)
    navFallbackRef.current = window.setTimeout(() => {
      router.push("/auth/login?from=landing");
    }, 7600);
  }

  function onLetterTransitionEnd(e: React.TransitionEvent<HTMLDivElement>) {
    if (!leaving) return;
    if (e.propertyName !== "transform") return;

    // If the fallback timer exists, cancel it and navigate now
    if (navFallbackRef.current) {
      window.clearTimeout(navFallbackRef.current);
      navFallbackRef.current = null;
    }
    router.push("/auth/login?from=landing");
  }

  const className = [
    styles.stage,
    phase >= 1 ? styles.phase1 : "",
    phase >= 2 ? styles.phase2 : "",
    phase >= 3 ? styles.phase3 : "",
    phase >= 4 ? styles.phase4 : "",
    leaving ? styles.leaving : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <main className={className}>
      <div className={styles.hubBtn}>
        <a href={HUB_URL} target="_blank" rel="noreferrer">
          ⟵ Back to hub
        </a>
      </div>

      <div className={styles.bg} aria-hidden="true">
        <Image src={BG_IMAGE_SRC} alt="" fill priority className={styles.bgImg} />
        <div className={styles.bgVignette} />
        <div className={styles.blackFade} />
      </div>

      <div className={styles.sparkles} aria-hidden="true" />

      <div className={styles.letterOverlay} aria-hidden="true" onTransitionEnd={onLetterTransitionEnd}>
        <img src={LETTER_IMAGE_SRC} alt="" className={styles.letterImg} />
      </div>

      <div className={styles.content}>
        <section className={styles.card}>
          <h1 className={styles.title}>WWRPG</h1>
          <p className={styles.tagline}>
            Your Wizarding World tabletop companion — campaigns, characters, combat decks, and DM tools.
          </p>

          <div className={styles.actions}>
            <button className={styles.primaryBtn} onClick={goToLogin}>
              <img src={LETTER_SMALL_IMAGE_SRC} alt="" className={styles.letterMiniImg} />
              <span>Enter (Login)</span>
            </button>
          </div>
        </section>
      </div>
    </main>
  );
}

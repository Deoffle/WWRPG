"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function LogoutButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function logout() {
    setBusy(true);
    await fetch("/api/auth/logout", { method: "POST" });
    setBusy(false);
    router.push("/auth/login");
    router.refresh();
  }

  return (
    <button className="border rounded-md px-3 py-2" onClick={logout} disabled={busy} type="button">
      {busy ? "Logging out…" : "Logout"}
    </button>
  );
}

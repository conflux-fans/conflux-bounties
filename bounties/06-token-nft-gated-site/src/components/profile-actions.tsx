"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function ProfileActions() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function logout() {
    setBusy(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      router.push("/");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      disabled={busy}
      onClick={() => void logout()}
      className="btn-secondary"
    >
      {busy ? "Signing out…" : "Sign out"}
    </button>
  );
}

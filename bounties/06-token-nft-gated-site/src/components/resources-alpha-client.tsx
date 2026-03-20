"use client";

import { useState } from "react";
import { GatedDownloadList, type GatedAssetBrief } from "./gated-download-list";

export function ResourcesAlphaClient({ assets }: { assets: GatedAssetBrief[] }) {
  const [ready, setReady] = useState(false);

  return (
    <section className="mt-14 border-t border-ink/[0.06] pt-12">
      <h2 className="section-subtitle">Client: gated downloads</h2>
      <p className="section-desc">
        After this page loads (SSR gate passed), request a{" "}
        <strong className="font-semibold text-ink">short-lived signed URL</strong>{" "}
        — the file request does not need the session cookie. Integrity digest
        comes back with the link and is echoed as{" "}
        <span className="kbd-inline">X-Content-Sha256</span> on download.
      </p>
      {!ready ? (
        <button
          type="button"
          onClick={() => setReady(true)}
          className="btn-primary mt-6"
        >
          Load download UI
        </button>
      ) : (
        <div className="mt-6">
          <GatedDownloadList assets={assets} />
        </div>
      )}
    </section>
  );
}

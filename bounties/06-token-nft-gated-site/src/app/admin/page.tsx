import { AdminRulesClient } from "@/components/admin-rules-client";
import { AdminListsClient } from "@/components/admin-lists-client";
import { AdminLogsPreview } from "@/components/admin-logs-preview";
import { AdminAssetsClient } from "@/components/admin-assets-client";
import { AdminMetadataClient } from "@/components/admin-metadata-client";

export default function AdminPage() {
  return (
    <div className="space-y-14">
      <div>
        <h2 className="section-title">Gating rules</h2>
        <p className="section-desc max-w-2xl">
          Changes apply on the next request (no redeploy). Path patterns like{" "}
          <span className="kbd-inline">/members</span> or{" "}
          <span className="kbd-inline">/resources/*</span>.
        </p>
        <div className="mt-8">
          <AdminRulesClient />
        </div>
      </div>

      <section className="border-t border-ink/[0.06] pt-14">
        <h2 className="section-subtitle">Gated assets</h2>
        <p className="section-desc max-w-2xl">
          Upload files to{" "}
          <span className="kbd-inline">storage/gated/uploads</span>. Members
          request a <strong className="font-medium text-ink">signed URL</strong>{" "}
          after passing rules; downloads log{" "}
          <span className="kbd-inline">sha256</span> in audit metadata.
        </p>
        <div className="mt-8">
          <AdminAssetsClient />
        </div>
      </section>

      <section className="border-t border-ink/[0.06] pt-14">
        <h2 className="section-subtitle">Token metadata cache</h2>
        <p className="section-desc max-w-2xl">
          Pull <span className="kbd-inline">name</span> /{" "}
          <span className="kbd-inline">symbol</span> (and ERC1155{" "}
          <span className="kbd-inline">uri</span>) via RPC into Postgres. “Refresh
          from rules” walks enabled gating rules.
        </p>
        <div className="mt-8">
          <AdminMetadataClient />
        </div>
      </section>

      <section className="border-t border-ink/[0.06] pt-14">
        <h2 className="section-subtitle">Allow / deny lists</h2>
        <p className="section-desc">
          Allowlist skips token checks. Denylist always blocks.
        </p>
        <div className="mt-8">
          <AdminListsClient />
        </div>
      </section>

      <section className="border-t border-ink/[0.06] pt-14">
        <h2 className="section-subtitle">Recent access</h2>
        <p className="section-desc">Last 30 events from the access log API.</p>
        <div className="mt-8">
          <AdminLogsPreview />
        </div>
      </section>
    </div>
  );
}

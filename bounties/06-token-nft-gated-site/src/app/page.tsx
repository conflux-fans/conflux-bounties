import Link from "next/link";

export default function HomePage() {
  return (
    <div className="relative overflow-hidden">
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.35]"
        aria-hidden
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%230f766e' fill-opacity='0.07'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
        }}
      />
      <main className="relative mx-auto max-w-5xl px-5 pb-24 pt-12 sm:px-6 sm:pb-32 sm:pt-16">
        <p className="eyebrow">Bounty #06 · Boilerplate</p>
        <h1 className="mt-4 max-w-3xl font-display text-4xl font-semibold leading-[1.1] tracking-tight text-ink sm:text-5xl md:text-[3.25rem]">
          Token &amp; NFT gated experiences on{" "}
          <span className="bg-gradient-to-r from-accent to-teal-500 bg-clip-text text-transparent">
            Conflux eSpace
          </span>
        </h1>
        <p className="mt-6 max-w-2xl text-lg leading-relaxed text-ink-muted">
          Wallet SIWE login, Postgres sessions, ERC20 / ERC721 / ERC1155 rules,
          allow/deny lists, rate limits, protected APIs, and signed file
          downloads — tuned for mainnet (1030) and testnet (71).
        </p>
        <div className="mt-10 flex flex-wrap gap-3">
          <Link href="/login" className="btn-primary">
            Connect &amp; sign in
          </Link>
          <Link href="/admin" className="btn-secondary">
            Admin console
          </Link>
        </div>

        <div className="mt-20 grid gap-5 md:grid-cols-3">
          <div className="ui-card group transition hover:border-accent/20">
            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-accent-soft text-lg font-semibold text-accent">
              01
            </div>
            <h2 className="font-display text-lg font-semibold text-ink">
              SIWE + session
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-ink-muted">
              Nonce, typed message, httpOnly cookie — wallet connected is not the
              same as signed in.
            </p>
          </div>
          <div className="ui-card group transition hover:border-accent/20">
            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-accent-soft text-lg font-semibold text-accent">
              02
            </div>
            <h2 className="font-display text-lg font-semibold text-ink">
              On-chain gating
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-ink-muted">
              Path patterns, JSON conditions, allowlist shortcuts — evaluated on
              each protected request.
            </p>
          </div>
          <div className="ui-card group transition hover:border-accent/20">
            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-accent-soft text-lg font-semibold text-accent">
              03
            </div>
            <h2 className="font-display text-lg font-semibold text-ink">
              Signed assets
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-ink-muted">
              Issue HMAC URLs after rules pass; integrity headers on download
              for audit trails.
            </p>
          </div>
        </div>

        <section className="mt-20 border-t border-ink/[0.06] pt-16">
          <h2 className="section-title">Ship checklist</h2>
          <p className="section-desc max-w-2xl">
            Wire env, Docker, and SIWE domain before production. Rule examples live
            in the repo README.
          </p>
          <div className="mt-10 grid gap-8 md:grid-cols-2">
            <div className="ui-card-tight">
              <h3 className="text-sm font-semibold text-ink">Docs &amp; env</h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-muted">
                See <span className="kbd-inline">README.md</span> for env vars,
                compose, SIWE domain alignment, and sample{" "}
                <span className="kbd-inline">rulesJson</span>.
              </p>
            </div>
            <div className="ui-card-tight">
              <h3 className="text-sm font-semibold text-ink">Protected API</h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-muted">
                After sign-in and gating, call{" "}
                <span className="kbd-inline">GET /api/protected/ping</span> for
                paths your rules cover.
              </p>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

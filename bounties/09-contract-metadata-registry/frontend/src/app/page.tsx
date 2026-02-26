import Link from 'next/link';

export default function Home() {
  return (
    <div className="relative">
      <div className="absolute inset-0 hero-glow pointer-events-none" aria-hidden />
      <section className="page-section container-narrow relative">
        <div className="mx-auto max-w-3xl text-center">
          <h1 className="text-4xl font-bold tracking-tight text-[rgb(var(--color-text))] sm:text-5xl lg:text-6xl">
            Verified metadata for
            <span className="block text-[rgb(var(--color-accent))]">Conflux contracts</span>
          </h1>
          <p className="mt-6 text-lg text-[rgb(var(--color-text-muted))]">
            Register your contract metadata, get a content-addressed CID and checksum, and publish to the registry. Explore verified contracts and their ABIs in one place.
          </p>
          <div className="mt-10 flex flex-col items-stretch gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-center">
            <Link href="/submit" className="btn-primary w-full text-center text-base px-6 py-3 sm:w-auto">
              Register metadata
            </Link>
            <Link href="/explore" className="btn-secondary w-full text-center text-base px-6 py-3 sm:w-auto">
              Explore contracts
            </Link>
          </div>
        </div>
      </section>

      <section className="page-section border-t border-[rgb(var(--color-border))]/50">
        <div className="container-narrow">
          <h2 className="text-center text-2xl font-semibold text-[rgb(var(--color-text))] sm:text-3xl">
            What you can do
          </h2>
          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            <Link
              href="/submit"
              className="card group p-6 transition-all hover:border-[rgb(var(--color-accent))]/40 hover:shadow-glow"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[rgb(var(--color-accent))]/20 text-[rgb(var(--color-accent))]">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              </div>
              <h3 className="mt-4 font-semibold text-[rgb(var(--color-text))]">Submit</h3>
              <p className="mt-2 text-sm text-[rgb(var(--color-text-muted))]">
                Register your contract metadata with name, description, ABI, and optional logo. Get a CID and checksum, sign with your wallet, and submit to the registry.
              </p>
              <span className="mt-4 inline-flex items-center text-sm font-medium text-[rgb(var(--color-accent))] group-hover:underline">
                Go to Submit →
              </span>
            </Link>

            <Link
              href="/explore"
              className="card group p-6 transition-all hover:border-[rgb(var(--color-accent))]/40 hover:shadow-glow"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[rgb(var(--color-accent))]/20 text-[rgb(var(--color-accent))]">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <h3 className="mt-4 font-semibold text-[rgb(var(--color-text))]">Explore</h3>
              <p className="mt-2 text-sm text-[rgb(var(--color-text-muted))]">
                Search and browse approved contract metadata. Filter by name, description, or tags and open contract details and ABI viewers.
              </p>
              <span className="mt-4 inline-flex items-center text-sm font-medium text-[rgb(var(--color-accent))] group-hover:underline">
                Open Explorer →
              </span>
            </Link>

            <Link
              href="/admin"
              className="card group p-6 transition-all hover:border-[rgb(var(--color-accent))]/40 hover:shadow-glow"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[rgb(var(--color-accent))]/20 text-[rgb(var(--color-accent))]">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <h3 className="mt-4 font-semibold text-[rgb(var(--color-text))]">Admin</h3>
              <p className="mt-2 text-sm text-[rgb(var(--color-text-muted))]">
                Moderator dashboard for pending submissions. Approve or reject with your registered wallet and sync state on-chain.
              </p>
              <span className="mt-4 inline-flex items-center text-sm font-medium text-[rgb(var(--color-accent))] group-hover:underline">
                Moderator dashboard →
              </span>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}

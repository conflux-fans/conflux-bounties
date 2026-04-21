import Link from "next/link";

export function AppFooter() {
  return (
    <footer className="mt-auto border-t border-ink/[0.06] bg-surface/70 py-10 backdrop-blur-sm">
      <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-4 px-6 text-center sm:flex-row sm:text-left">
        <p className="text-xs text-ink-faint">
          Conflux eSpace · SIWE session · ERC20 / ERC721 / ERC1155 gating
        </p>
        <nav className="flex flex-wrap justify-center gap-x-5 gap-y-1 text-xs font-medium text-ink-muted">
          <Link href="/" className="transition hover:text-accent">
            Home
          </Link>
          <Link href="/login" className="transition hover:text-accent">
            Sign in
          </Link>
          <a
            href="https://doc.confluxnetwork.org/"
            className="transition hover:text-accent"
            target="_blank"
            rel="noreferrer"
          >
            Docs
          </a>
        </nav>
      </div>
    </footer>
  );
}

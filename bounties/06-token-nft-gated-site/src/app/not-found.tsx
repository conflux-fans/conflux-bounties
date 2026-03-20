import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-[50vh] max-w-lg flex-col items-center justify-center px-6 py-24 text-center">
      <p className="eyebrow">404</p>
      <h1 className="mt-3 font-display text-3xl font-semibold text-ink">
        Page not found
      </h1>
      <p className="mt-3 text-sm text-ink-muted">
        That route doesn’t exist or was moved.
      </p>
      <Link href="/" className="btn-primary mt-10">
        Go home
      </Link>
    </main>
  );
}

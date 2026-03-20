export default function MembersLoading() {
  return (
    <main className="mx-auto max-w-2xl px-5 py-16 sm:px-6">
      <div className="h-3 w-28 animate-pulse rounded-full bg-accent-soft" />
      <div className="mt-5 h-10 w-3/4 max-w-md animate-pulse rounded-xl bg-ink/[0.06]" />
      <div className="mt-6 h-24 animate-pulse rounded-2xl bg-ink/[0.04]" />
      <ul className="mt-10 space-y-3">
        <li className="h-14 animate-pulse rounded-xl bg-ink/[0.04]" />
        <li className="h-14 animate-pulse rounded-xl bg-ink/[0.04]" />
      </ul>
    </main>
  );
}

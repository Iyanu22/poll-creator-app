// Placeholder until the landing page is designed: proves tokens, fonts,
// and the Tailwind mapping are wired up.
export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-content flex-1 flex-col justify-center gap-6 px-6 py-16">
      <h1 className="text-2xl font-extrabold tracking-[-0.02em]">Tiebreak</h1>
      <p className="text-md text-cocoa-soft">
        Settle group decisions, right in the group chat.
      </p>
      <div className="flex flex-wrap gap-3">
        <span className="rounded-full border-[length:var(--border-chip)] border-cocoa bg-teal-soft px-3 py-1 text-xs font-bold tracking-[0.06em] text-teal-deep uppercase">
          Voting open
        </span>
        <span className="rounded-full border-[length:var(--border-chip)] border-cocoa bg-butter px-3 py-1 text-xs font-bold tracking-[0.06em] uppercase">
          In the lead
        </span>
      </div>
    </main>
  );
}

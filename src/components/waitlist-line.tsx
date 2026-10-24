// How many people ahead of you are drawn before the rest become "+N".
const SHOWN = 5;

// The line you're standing in: the door, the people ahead of you, then you.
// The sentence next to it says the same thing in words, so this is hidden
// from screen readers.
export function WaitlistLine({ position, justJoined = false }: { position: number; justJoined?: boolean }) {
  const ahead = Math.max(0, position - 1);
  const drawn = Math.min(ahead, SHOWN);
  return (
    <div className="flex items-end gap-1.5 text-[11px] text-muted" aria-hidden="true">
      <span className="flex flex-col items-center gap-1">
        <svg width="14" height="18" viewBox="0 0 14 18" fill="none" stroke="currentColor" strokeWidth="1.4" className="text-ink">
          <path d="M2 17V2.5A1.5 1.5 0 0 1 3.5 1h7A1.5 1.5 0 0 1 12 2.5V17M.5 17h13" />
          <circle cx="9.3" cy="9.5" r=".8" fill="currentColor" stroke="none" />
        </svg>
        Door
      </span>
      <span className="mb-[18px] flex items-end gap-1">
        {Array.from({ length: drawn }, (_, i) => (
          <Person key={i} className="text-faint" />
        ))}
        {ahead > drawn && <span className="px-0.5 leading-4">+{ahead - drawn}</span>}
      </span>
      <span className={`flex flex-col items-center gap-1 ${justJoined ? "animate-[join_700ms_ease-out_both]" : ""}`}>
        <Person className="text-warn" />
        You
      </span>
    </div>
  );
}

function Person({ className }: { className: string }) {
  return (
    <svg width="12" height="16" viewBox="0 0 12 16" fill="currentColor" className={className}>
      <circle cx="6" cy="3.5" r="3" />
      <path d="M0.5 16c0-3.6 2.4-6 5.5-6s5.5 2.4 5.5 6z" />
    </svg>
  );
}

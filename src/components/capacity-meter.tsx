export function CapacityMeter({ taken, capacity, waitlisted }: { taken: number; capacity: number; waitlisted: number }) {
  const pct = Math.min(100, Math.round((taken / capacity) * 100));
  return (
    <div>
      <div className="flex justify-between text-[13px]">
        <span>
          {taken} of {capacity} spots taken
        </span>
        {waitlisted > 0 && <span className="text-warn">{waitlisted} waiting</span>}
      </div>
      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface-2">
        <div
          className={`h-full animate-[fill_900ms_ease-out_both] rounded-full ${pct >= 100 ? "bg-warn" : "bg-accent"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

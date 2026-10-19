"use client";

import { useMemo, useState } from "react";
import { formatTicketCode } from "@/lib/tickets";
import { formatDateTime } from "@/lib/time";
import type { Attendee } from "@/lib/types";
import { Badge } from "../badges";

const FILTERS = [
  { key: "all", label: "All", match: (a: Attendee) => a.status !== "cancelled" },
  { key: "confirmed", label: "Going", match: (a: Attendee) => a.status === "confirmed" },
  { key: "checked-in", label: "Checked in", match: (a: Attendee) => a.status === "confirmed" && !!a.checkedInAt },
  { key: "not-in", label: "Not here yet", match: (a: Attendee) => a.status === "confirmed" && !a.checkedInAt },
  { key: "waitlisted", label: "Waitlist", match: (a: Attendee) => a.status === "waitlisted" },
  { key: "cancelled", label: "Cancelled", match: (a: Attendee) => a.status === "cancelled" },
] as const;

export function AttendeesTable({ attendees }: { eventId: string; attendees: Attendee[] }) {
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["key"]>("all");
  const [query, setQuery] = useState("");

  const counts = useMemo(
    () => Object.fromEntries(FILTERS.map((f) => [f.key, attendees.filter(f.match).length])),
    [attendees],
  );
  const rows = useMemo(() => {
    const match = FILTERS.find((f) => f.key === filter)!.match;
    const q = query.trim().toLowerCase().replace(/-/g, "");
    return attendees.filter(
      (a) =>
        match(a) &&
        (!q || a.name.toLowerCase().includes(q) || a.email.toLowerCase().includes(q) || a.ticketCode.toLowerCase().includes(q)),
    );
  }, [attendees, filter, query]);

  return (
    <div className="card">
      <div className="flex flex-col gap-3 border-b border-line p-4 md:flex-row md:items-center md:justify-between">
        <h2 className="font-medium">People</h2>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search name, email, or ticket code"
          aria-label="Search people"
          className="input md:max-w-xs"
        />
      </div>
      <div className="flex gap-1 overflow-x-auto border-b border-line px-3 py-2 text-[13px]" role="tablist">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            role="tab"
            aria-selected={filter === f.key}
            onClick={() => setFilter(f.key)}
            className={`shrink-0 rounded-md px-2.5 py-1 ${filter === f.key ? "bg-surface-2 text-ink" : "text-muted hover:text-ink"}`}
          >
            {f.label} <span className="tabular-nums text-faint">{counts[f.key]}</span>
          </button>
        ))}
      </div>
      {rows.length === 0 ? (
        <p className="p-6 text-center text-sm text-muted">Nobody here.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[13px] text-muted">
                <th className="px-4 py-2 font-medium">Name</th>
                <th className="px-4 py-2 font-medium">Status</th>
                <th className="hidden px-4 py-2 font-medium md:table-cell">Ticket</th>
                <th className="hidden px-4 py-2 font-medium sm:table-cell">Registered</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((a) => (
                <tr key={a.id}>
                  <td className="px-4 py-2.5">
                    <div className="font-medium">{a.name}</div>
                    <div className="text-[13px] text-muted">{a.email}</div>
                  </td>
                  <td className="px-4 py-2.5">
                    <StatusCell attendee={a} />
                  </td>
                  <td className="hidden px-4 py-2.5 font-mono text-[13px] text-muted md:table-cell">
                    {formatTicketCode(a.ticketCode)}
                  </td>
                  <td className="hidden px-4 py-2.5 text-[13px] whitespace-nowrap text-muted sm:table-cell">
                    {formatDateTime(a.registeredAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function StatusCell({ attendee: a }: { attendee: Attendee }) {
  if (a.status === "cancelled") return <Badge tone="muted">Cancelled</Badge>;
  if (a.status === "waitlisted") return <Badge tone="warn">Waitlist #{a.waitlistPosition}</Badge>;
  if (a.checkedInAt) {
    return (
      <span className="text-[13px] whitespace-nowrap">
        <Badge tone="ok">Checked in</Badge> <span className="text-muted">{formatDateTime(a.checkedInAt)}</span>
      </span>
    );
  }
  return <Badge tone="plain">Going</Badge>;
}

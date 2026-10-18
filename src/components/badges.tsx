const tones = {
  ok: "bg-ok-soft text-ok",
  warn: "bg-warn-soft text-warn",
  bad: "bg-bad-soft text-bad",
  muted: "bg-surface-2 text-muted",
  accent: "bg-accent-soft text-accent",
};

export function Badge({ tone, children }: { tone: keyof typeof tones; children: React.ReactNode }) {
  return (
    <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium whitespace-nowrap ${tones[tone]}`}>
      {children}
    </span>
  );
}

type TicketState = {
  status: "confirmed" | "waitlisted" | "cancelled";
  checkedInAt: string | null;
  waitlistPosition: number | null;
  eventStatus: "draft" | "published" | "cancelled";
};

export function TicketBadge({ status, checkedInAt, waitlistPosition, eventStatus }: TicketState) {
  if (eventStatus === "cancelled") return <Badge tone="bad">Event cancelled</Badge>;
  if (status === "cancelled") return <Badge tone="muted">Cancelled</Badge>;
  if (checkedInAt) return <Badge tone="muted">Checked in</Badge>;
  if (status === "waitlisted") return <Badge tone="warn">Waitlist #{waitlistPosition}</Badge>;
  return <Badge tone="ok">Going</Badge>;
}

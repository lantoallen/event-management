// Statuses are plain text. Only the ones that need attention get a color,
// so a list where everything is fine stays quiet.
const tones = {
  plain: "text-ink",
  ok: "text-ok",
  warn: "text-warn",
  bad: "text-bad",
  muted: "text-muted",
};

export function Badge({ tone, children }: { tone: keyof typeof tones; children: React.ReactNode }) {
  return <span className={`text-[13px] font-medium whitespace-nowrap ${tones[tone]}`}>{children}</span>;
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

import { Badge } from "../badges";

export function EventStatusBadge({
  status,
  endsAt,
  onDark = false,
}: {
  status: "draft" | "published" | "cancelled";
  endsAt: string;
  onDark?: boolean;
}) {
  if (onDark) {
    const label = status === "draft" ? "Draft" : status === "cancelled" ? "Cancelled" : new Date(endsAt) <= new Date() ? "Ended" : "Published";
    const color = status === "draft" ? "text-[#f3d27a]" : status === "cancelled" ? "text-[#ffb3a8]" : "text-hero-ink";
    return <span className={`text-[13px] font-medium ${color}`}>{label}</span>;
  }
  if (status === "draft") return <Badge tone="warn">Draft</Badge>;
  if (status === "cancelled") return <Badge tone="bad">Cancelled</Badge>;
  if (new Date(endsAt) <= new Date()) return <Badge tone="muted">Ended</Badge>;
  return <Badge tone="plain">Published</Badge>;
}

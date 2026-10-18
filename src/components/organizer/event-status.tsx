import { Badge } from "../badges";

export function EventStatusBadge({ status, endsAt }: { status: "draft" | "published" | "cancelled"; endsAt: string }) {
  if (status === "draft") return <Badge tone="muted">Draft</Badge>;
  if (status === "cancelled") return <Badge tone="bad">Cancelled</Badge>;
  if (new Date(endsAt) <= new Date()) return <Badge tone="muted">Ended</Badge>;
  return <Badge tone="ok">Published</Badge>;
}

import { CATEGORY_COLOR, CATEGORY_LABELS } from "@/lib/categories";
import type { EventCategory } from "@/server/db/schema";

// The category name with its color marker, the same marker the home page uses.
export function CategoryLabel({ category }: { category: EventCategory }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="h-2 w-2 rounded-sm" style={{ background: CATEGORY_COLOR[category] }} aria-hidden="true" />
      {CATEGORY_LABELS[category]}
    </span>
  );
}

// Half-circle cut-outs on both edges of a card, where a dashed tear line
// crosses it. The card needs `relative overflow-hidden`; `inset` is the card's
// horizontal padding plus its border, so the circles sit centered on the edge.
export function TicketNotches({ inset }: { inset: number }) {
  const style = (side: "left" | "right") => ({ [side]: -(inset + 12) });
  return (
    <>
      <span className="absolute -top-[13px] h-6 w-6 rounded-full border border-line bg-bg" style={style("left")} aria-hidden="true" />
      <span className="absolute -top-[13px] h-6 w-6 rounded-full border border-line bg-bg" style={style("right")} aria-hidden="true" />
    </>
  );
}

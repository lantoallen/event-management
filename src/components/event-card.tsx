import Link from "next/link";
import { CATEGORY_TINT } from "@/lib/categories";
import { formatDay, formatMonth, formatTime, formatWeekdayDate, relativeDays } from "@/lib/time";
import type { EventCategory } from "@/server/db/schema";

export type EventCardData = {
  slug: string;
  title: string;
  summary: string;
  category: EventCategory;
  startsAt: string;
  isOnline: boolean;
  city: string;
  organizerName: string;
  spotsLeft: number;
  capacity: number;
};

export function DateBlock({ date, category }: { date: string; category: EventCategory }) {
  return (
    <div className={`flex w-14 shrink-0 flex-col items-center justify-center rounded-md py-2 ${CATEGORY_TINT[category]}`}>
      <span className="text-[11px] font-semibold tracking-wider">{formatMonth(date)}</span>
      <span className="text-2xl leading-tight font-semibold">{formatDay(date)}</span>
    </div>
  );
}

export function Availability({ spotsLeft, capacity }: { spotsLeft: number; capacity: number }) {
  if (spotsLeft === 0) return <span className="text-warn">Full, waitlist open</span>;
  if (spotsLeft <= Math.max(3, capacity * 0.1)) {
    return <span className="text-warn">{spotsLeft === 1 ? "1 spot left" : `${spotsLeft} spots left`}</span>;
  }
  return <span className="text-accent">{spotsLeft} spots left</span>;
}

export function EventCard({ event }: { event: EventCardData }) {
  const soon = relativeDays(event.startsAt);
  return (
    <Link
      href={`/events/${event.slug}`}
      className="card group flex gap-4 p-4 transition-colors hover:border-line-strong"
    >
      <DateBlock date={event.startsAt} category={event.category} />
      <div className="min-w-0 flex-1">
        <p className="text-[13px] text-muted">
          {soon ?? formatWeekdayDate(event.startsAt)}, {formatTime(event.startsAt)} · {event.city}
        </p>
        <h3 className="mt-0.5 leading-snug font-semibold group-hover:underline group-hover:underline-offset-2">
          {event.title}
        </h3>
        <p className="mt-1 line-clamp-2 text-sm text-muted">{event.summary}</p>
        <p className="mt-2 flex flex-wrap gap-x-3 text-[13px]">
          <span className="text-muted">{event.organizerName}</span>
          <Availability spotsLeft={event.spotsLeft} capacity={event.capacity} />
        </p>
      </div>
    </Link>
  );
}

export function EventCardSkeleton() {
  return (
    <div className="card flex gap-4 p-4">
      <div className="h-16 w-14 rounded-md bg-surface-2" />
      <div className="flex-1 space-y-2 py-1">
        <div className="h-3 w-1/3 rounded bg-surface-2" />
        <div className="h-4 w-2/3 rounded bg-surface-2" />
        <div className="h-3 w-full rounded bg-surface-2" />
      </div>
    </div>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { BrowseSearch } from "@/components/browse-search";
import { CategoryLabel } from "@/components/category-label";
import { Availability } from "@/components/event-card";
import { Column, FullBleed } from "@/components/full-bleed";
import { CATEGORY_COLOR, CATEGORY_LABELS } from "@/lib/categories";
import { load, serverApi } from "@/lib/server-api";
import { formatTime, formatWeekdayDate, manilaDayKey, relativeDays } from "@/lib/time";
import { categories, type EventCategory } from "@/server/db/schema";

type Search = { q?: string; category?: string; when?: string; page?: string };

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

async function readSearch(searchParams: PageProps<"/events">["searchParams"]): Promise<Search> {
  const sp = await searchParams;
  return { q: first(sp.q), category: first(sp.category), when: first(sp.when), page: first(sp.page) };
}

function hrefWith(search: Search, changes: Partial<Search>) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries({ ...search, page: undefined, ...changes })) {
    if (value && !(key === "when" && value === "all")) params.set(key, value);
  }
  const qs = params.toString();
  return qs ? `/events?${qs}` : "/events";
}

export const metadata: Metadata = { title: "Upcoming events" };

export default function BrowsePage({ searchParams }: PageProps<"/events">) {
  return (
    <>
      {/* The search sits in a green band joined to the header. */}
      <FullBleed className="photo photo-band -mt-8 text-hero-ink">
        <Column className="pt-4 pb-8 md:pt-6 md:pb-10">
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Upcoming events</h1>
          <Suspense fallback={<div className="mt-5 h-[96px] sm:h-11" />}>
            <BrowseSearch />
          </Suspense>
        </Column>
      </FullBleed>

      {/* Categories in a column on the left; on phones they become a row that scrolls sideways. */}
      <div className="mt-6 grid grid-cols-1 gap-6 md:mt-8 md:grid-cols-[180px_minmax(0,1fr)] md:gap-10">
        <Suspense fallback={<div className="h-10 md:h-80" />}>
          <CategoryNav searchParams={searchParams} />
        </Suspense>
        <div className="min-w-0">
          <Suspense fallback={<AgendaSkeleton />}>
            <Agenda searchParams={searchParams} />
          </Suspense>
        </div>
      </div>
    </>
  );
}

async function CategoryNav({ searchParams }: { searchParams: PageProps<"/events">["searchParams"] }) {
  const search = await readSearch(searchParams);
  const items: { key: EventCategory | null; label: string }[] = [
    { key: null, label: "All events" },
    ...categories.map((c) => ({ key: c, label: CATEGORY_LABELS[c] })),
  ];
  return (
    <nav aria-label="Categories" className="min-w-0 md:sticky md:top-6 md:self-start">
      <ul className="-mx-4 flex gap-1 overflow-x-auto px-4 text-sm [scrollbar-width:none] md:mx-0 md:flex-col md:px-0">
        {items.map(({ key, label }) => {
          const active = (search.category ?? null) === key;
          return (
            <li key={label} className="shrink-0">
              <Link
                href={hrefWith(search, { category: key ?? undefined })}
                aria-current={active ? "page" : undefined}
                className={`flex items-center gap-2.5 rounded-md px-3 py-2 ${
                  active ? "bg-surface font-medium text-ink shadow-[inset_0_0_0_1px_var(--line)]" : "text-muted hover:text-ink"
                }`}
              >
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-sm"
                  style={{ background: key ? CATEGORY_COLOR[key] : "var(--ink)" }}
                  aria-hidden="true"
                />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

type AgendaEvent = {
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

async function Agenda({ searchParams }: { searchParams: PageProps<"/events">["searchParams"] }) {
  const search = await readSearch(searchParams);
  const client = await serverApi();
  const category = categories.includes(search.category as EventCategory) ? search.category : undefined;
  const { events, page, hasMore } = await load(
    client.api.events.$get({
      query: {
        q: search.q,
        category: category as EventCategory | undefined,
        when: search.when as "all" | undefined,
        page: search.page,
      },
    }),
  );

  if (events.length === 0) {
    return (
      <div className="card p-8 text-center">
        <p className="font-medium">Nothing matches that.</p>
        <p className="mt-1 text-sm text-muted">
          Try another search, or{" "}
          <Link href="/events" className="link">
            see everything coming up
          </Link>
          .
        </p>
      </div>
    );
  }

  const now = new Date();
  return (
    <>
      <div className="space-y-8">
        {groupByDay(events).map(({ day, items }) => (
          <section key={day}>
            <h2 className="mb-3 flex items-baseline gap-2">
              <span className="font-semibold">{relativeDays(items[0].startsAt, now) ?? formatWeekdayDate(items[0].startsAt)}</span>
              {relativeDays(items[0].startsAt, now) && (
                <span className="text-sm text-muted">{formatWeekdayDate(items[0].startsAt)}</span>
              )}
            </h2>
            <ul className="card divide-y divide-line overflow-hidden">
              {items.map((event) => (
                <li key={event.slug}>
                  <AgendaRow event={event} />
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
      {(page > 1 || hasMore) && (
        <div className="mt-8 flex justify-between text-sm">
          {page > 1 ? (
            <Link className="btn-secondary" href={hrefWith(search, { page: String(page - 1) })}>
              Previous
            </Link>
          ) : (
            <span />
          )}
          {hasMore && (
            <Link className="btn-secondary" href={hrefWith(search, { page: String(page + 1) })}>
              More events
            </Link>
          )}
        </div>
      )}
    </>
  );
}

// One line of the agenda: the time on the left, then what and where.
function AgendaRow({ event }: { event: AgendaEvent }) {
  return (
    <Link
      href={`/events/${event.slug}`}
      className="group grid grid-cols-[4.5rem_1fr] gap-x-4 px-4 py-4 transition-colors hover:bg-surface-2 sm:grid-cols-[5.5rem_1fr_auto] sm:items-center sm:px-5"
    >
      <span className="pt-0.5 text-sm font-medium tabular-nums sm:pt-0">{formatTime(event.startsAt)}</span>
      <div className="min-w-0">
        <h3 className="leading-snug font-semibold group-hover:underline group-hover:underline-offset-2">{event.title}</h3>
        <span className="mt-0.5 line-clamp-1 text-sm text-muted">{event.summary}</span>
        <span className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[13px] text-muted">
          <CategoryLabel category={event.category} />
          <span>{event.isOnline ? "Online" : event.city}</span>
          <span>{event.organizerName}</span>
          <span className="sm:hidden">
            <Availability spotsLeft={event.spotsLeft} capacity={event.capacity} />
          </span>
        </span>
      </div>
      <span className="hidden text-right text-[13px] whitespace-nowrap sm:block">
        <Availability spotsLeft={event.spotsLeft} capacity={event.capacity} />
      </span>
    </Link>
  );
}

function groupByDay<T extends { startsAt: string }>(events: T[]) {
  const groups: { day: string; items: T[] }[] = [];
  for (const event of events) {
    const day = manilaDayKey(event.startsAt);
    const last = groups.at(-1);
    if (last?.day === day) last.items.push(event);
    else groups.push({ day, items: [event] });
  }
  return groups;
}

function AgendaSkeleton() {
  return (
    <div className="space-y-8" aria-hidden="true">
      {[0, 1].map((i) => (
        <div key={i}>
          <div className="mb-3 h-5 w-40 rounded bg-surface-2" />
          <div className="card divide-y divide-line">
            {[0, 1].map((j) => (
              <div key={j} className="flex gap-4 p-4">
                <div className="h-4 w-14 rounded bg-surface-2" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-2/3 rounded bg-surface-2" />
                  <div className="h-3 w-full rounded bg-surface-2" />
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

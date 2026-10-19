import Link from "next/link";
import { Suspense } from "react";
import { EventCard, EventCardSkeleton } from "@/components/event-card";
import { CATEGORY_LABELS } from "@/lib/categories";
import { load, serverApi } from "@/lib/server-api";
import { formatMonthName, manilaDayKey, manilaStartOfDay } from "@/lib/time";
import { categories, type EventCategory } from "@/server/db/schema";

type Search = { q?: string; category?: string; when?: string; page?: string };

const WHEN = [
  ["all", "Any time"],
  ["today", "Today"],
  ["weekend", "This weekend"],
  ["week", "Next 7 days"],
  ["month", "Next 30 days"],
] as const;

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

async function readSearch(searchParams: PageProps<"/">["searchParams"]): Promise<Search> {
  const sp = await searchParams;
  return { q: first(sp.q), category: first(sp.category), when: first(sp.when), page: first(sp.page) };
}

function hrefWith(search: Search, changes: Partial<Search>) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries({ ...search, page: undefined, ...changes })) {
    if (value && !(key === "when" && value === "all")) params.set(key, value);
  }
  const qs = params.toString();
  return qs ? `/?${qs}` : "/";
}

export default function BrowsePage({ searchParams }: PageProps<"/">) {
  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">Upcoming events</h1>
      <Suspense fallback={<div className="mt-6 h-[92px]" />}>
        <Filters searchParams={searchParams} />
      </Suspense>
      <Suspense fallback={<ResultsSkeleton />}>
        <Results searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function Filters({ searchParams }: { searchParams: PageProps<"/">["searchParams"] }) {
  const search = await readSearch(searchParams);
  return (
    <div className="mt-6 space-y-3">
      {/* Phones: search box and button on one row, the date filter under them. Wider: one row. */}
      <form action="/" className="grid grid-cols-[1fr_auto] gap-2 sm:flex">
        {search.category && <input type="hidden" name="category" value={search.category} />}
        <label className="sr-only" htmlFor="q">
          Search
        </label>
        <input
          id="q"
          name="q"
          type="search"
          defaultValue={search.q}
          placeholder="Search by title or city"
          className="input sm:max-w-sm"
        />
        <label className="sr-only" htmlFor="when">
          When
        </label>
        <select
          id="when"
          name="when"
          defaultValue={search.when ?? "all"}
          className="input col-span-2 row-start-2 sm:w-44"
        >
          {WHEN.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <button className="btn-secondary">Search</button>
      </form>
      {/* One line that scrolls sideways on narrow screens instead of wrapping. */}
      <div className="-mx-4 flex gap-x-5 overflow-x-auto border-b border-line px-4 text-sm whitespace-nowrap [scrollbar-width:none] sm:mx-0 sm:px-0">
        <CategoryLink href={hrefWith(search, { category: undefined })} active={!search.category}>
          All
        </CategoryLink>
        {categories.map((c) => (
          <CategoryLink key={c} href={hrefWith(search, { category: c })} active={search.category === c}>
            {CATEGORY_LABELS[c]}
          </CategoryLink>
        ))}
      </div>
    </div>
  );
}

function CategoryLink({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      aria-current={active ? "true" : undefined}
      className={`-mb-px border-b-2 py-2 ${active ? "border-ink text-ink" : "border-transparent text-muted hover:text-ink"}`}
    >
      {children}
    </Link>
  );
}

async function Results({ searchParams }: { searchParams: PageProps<"/">["searchParams"] }) {
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
      <div className="card mt-6 p-8 text-center">
        <p className="font-medium">Nothing matches that.</p>
        <p className="mt-1 text-sm text-muted">
          Try another search, or{" "}
          <Link href="/" className="link">
            see everything coming up
          </Link>
          .
        </p>
      </div>
    );
  }

  return (
    <>
      {groupByWhen(events, new Date()).map((group) => (
        <section key={group.label} className="mt-8 first:mt-6">
          <h2 className="mb-3 text-sm font-medium text-muted">{group.label}</h2>
          <div className="grid gap-3 md:grid-cols-2">
            {group.events.map((event) => (
              <EventCard key={event.slug} event={event} />
            ))}
          </div>
        </section>
      ))}
      {(page > 1 || hasMore) && (
        <div className="mt-6 flex justify-between text-sm">
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

function ResultsSkeleton() {
  return (
    <div className="mt-6 grid gap-3 md:grid-cols-2" aria-hidden="true">
      {Array.from({ length: 6 }, (_, i) => (
        <EventCardSkeleton key={i} />
      ))}
    </div>
  );
}

// "Next 7 days", then one group per month, so a long list has landmarks.
function groupByWhen<T extends { startsAt: string }>(events: T[], now: Date) {
  const weekEnd = manilaStartOfDay(now, 7);
  const thisMonth = manilaDayKey(now).slice(0, 7);
  const groups: { label: string; events: T[] }[] = [];
  for (const event of events) {
    const start = new Date(event.startsAt);
    let label: string;
    if (start < weekEnd) label = "Next 7 days";
    else if (manilaDayKey(start).slice(0, 7) === thisMonth) label = `Later in ${formatMonthName(start)}`;
    else label = formatMonthName(start);
    const last = groups.at(-1);
    if (last?.label === label) last.events.push(event);
    else groups.push({ label, events: [event] });
  }
  return groups;
}

import Link from "next/link";
import { Suspense } from "react";
import { EventCard, EventCardSkeleton } from "@/components/event-card";
import { CATEGORY_LABELS } from "@/lib/categories";
import { load, serverApi } from "@/lib/server-api";
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
      <form action="/" className="flex flex-col gap-2 sm:flex-row">
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
        <select id="when" name="when" defaultValue={search.when ?? "all"} className="input sm:w-44">
          {WHEN.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <button className="btn-secondary">Search</button>
      </form>
      <div className="flex flex-wrap gap-x-5 gap-y-1 border-b border-line text-sm">
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
      <div className="mt-6 grid gap-3 md:grid-cols-2">
        {events.map((event) => (
          <EventCard key={event.slug} event={event} />
        ))}
      </div>
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

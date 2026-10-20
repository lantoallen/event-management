"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";

const WHEN = [
  ["all", "Any time"],
  ["today", "Today"],
  ["weekend", "This weekend"],
  ["week", "Next 7 days"],
  ["month", "Next 30 days"],
] as const;

const field =
  "h-11 w-full rounded-md border-0 bg-paper px-3 text-sm text-[#1d1b18] placeholder:text-[#8a847a] focus:outline-2 focus:outline-[#8fdcc0]";

// The browse page's search. Results update as you type (after a short pause)
// and when the date menu changes; without JavaScript it's a plain form.
export function BrowseSearch() {
  const router = useRouter();
  const params = useSearchParams();
  const [q, setQ] = useState(params.get("q") ?? "");
  const [pending, startTransition] = useTransition();
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  function go(changes: Record<string, string | undefined>) {
    const next = new URLSearchParams(params);
    next.delete("page");
    for (const [key, value] of Object.entries(changes)) {
      if (value && !(key === "when" && value === "all")) next.set(key, value);
      else next.delete(key);
    }
    const qs = next.toString();
    startTransition(() => router.replace(qs ? `/events?${qs}` : "/events", { scroll: false }));
  }

  function type(value: string) {
    setQ(value);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => go({ q: value.trim() || undefined }), 300);
  }

  return (
    // Phones: search box and button on one row, the date menu under them. Wider: one row.
    <form
      action="/events"
      role="search"
      data-browse-search
      className="mt-5 grid max-w-2xl grid-cols-[1fr_auto] gap-2 sm:flex"
      onSubmit={(e) => {
        e.preventDefault();
        clearTimeout(timer.current);
        go({ q: q.trim() || undefined });
      }}
    >
      {["category", "day"].map((key) => {
        const value = params.get(key);
        return value && <input key={key} type="hidden" name={key} value={value} />;
      })}
      <label className="sr-only" htmlFor="q">
        Search
      </label>
      <div className="relative min-w-0 sm:flex-1">
        <input
          id="q"
          name="q"
          type="search"
          data-search
          autoComplete="off"
          value={q}
          onChange={(e) => type(e.target.value)}
          placeholder="Search by title or city"
          className={`${field} pr-9`}
        />
        {pending && (
          <span
            className="absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2 animate-spin rounded-full border-2 border-[#d9d3c7] border-t-[#0f6b55]"
            role="status"
          >
            <span className="sr-only">Searching</span>
          </span>
        )}
      </div>
      <label className="sr-only" htmlFor="when">
        When
      </label>
      <select
        id="when"
        name="when"
        value={params.get("when") ?? "all"}
        onChange={(e) => go({ when: e.target.value, day: undefined })}
        className={`${field} col-span-2 row-start-2 sm:w-44`}
      >
        {WHEN.map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </select>
      <button className="btn h-11 bg-hero-ink text-hero hover:opacity-90">Search</button>
    </form>
  );
}

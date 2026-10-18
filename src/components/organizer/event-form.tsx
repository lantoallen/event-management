"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { api, errorMessage, unwrap } from "@/lib/api";
import { CATEGORY_LABELS } from "@/lib/categories";
import { fromLocalInput, manilaDayKey, toLocalInput } from "@/lib/time";
import type { OrganizerEvent } from "@/lib/types";
import { categories, type EventCategory } from "@/server/db/schema";

type Values = {
  title: string;
  summary: string;
  description: string;
  category: EventCategory;
  startsAt: string;
  endsAt: string;
  isOnline: boolean;
  location: string;
  city: string;
  capacity: string;
};

function initialValues(event?: OrganizerEvent): Values {
  if (event) {
    return {
      title: event.title,
      summary: event.summary,
      description: event.description,
      category: event.category,
      startsAt: toLocalInput(event.startsAt),
      endsAt: toLocalInput(event.endsAt),
      isOnline: event.isOnline,
      location: event.location,
      city: event.isOnline ? "" : event.city,
      capacity: String(event.capacity),
    };
  }
  // Next week, 6 to 8 PM Manila time.
  const day = manilaDayKey(new Date(Date.now() + 7 * 86_400_000));
  return {
    title: "",
    summary: "",
    description: "",
    category: "community",
    startsAt: `${day}T18:00`,
    endsAt: `${day}T20:00`,
    isOnline: false,
    location: "",
    city: "",
    capacity: "50",
  };
}

export function EventForm({ event }: { event?: OrganizerEvent }) {
  const router = useRouter();
  const [values, setValues] = useState(() => initialValues(event));
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const set = <K extends keyof Values>(key: K, value: Values[K]) => setValues((v) => ({ ...v, [key]: value }));

  function submit(publish: boolean) {
    setError(null);
    const body = {
      title: values.title,
      summary: values.summary,
      description: values.description,
      category: values.category,
      startsAt: fromLocalInput(values.startsAt).toISOString(),
      endsAt: fromLocalInput(values.endsAt).toISOString(),
      isOnline: values.isOnline,
      location: values.location,
      city: values.isOnline ? "" : values.city,
      capacity: Number(values.capacity),
    };
    start(async () => {
      try {
        const saved = event
          ? await unwrap(api.api.organizer.events[":id"].$patch({ param: { id: event.id }, json: body }))
          : await unwrap(api.api.organizer.events.$post({ json: { ...body, publish } }));
        router.push(`/organize/${saved.event.id}`);
        router.refresh();
      } catch (err) {
        setError(errorMessage(err));
      }
    });
  }

  return (
    <form
      className="card space-y-5 p-5"
      onSubmit={(e) => {
        e.preventDefault();
        submit(true);
      }}
    >
      <div>
        <label className="label" htmlFor="title">
          Title
        </label>
        <input id="title" required maxLength={120} className="input" value={values.title} onChange={(e) => set("title", e.target.value)} />
      </div>
      <div>
        <label className="label" htmlFor="summary">
          One-line summary
        </label>
        <input
          id="summary"
          required
          maxLength={200}
          className="input"
          value={values.summary}
          onChange={(e) => set("summary", e.target.value)}
        />
        <p className="mt-1 text-[13px] text-muted">Shows on the event card when people browse.</p>
      </div>
      <div>
        <label className="label" htmlFor="description">
          Details
        </label>
        <textarea
          id="description"
          required
          rows={6}
          maxLength={5000}
          className="input h-auto py-2 leading-relaxed"
          value={values.description}
          onChange={(e) => set("description", e.target.value)}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label className="label" htmlFor="category">
            Category
          </label>
          <select
            id="category"
            className="input"
            value={values.category}
            onChange={(e) => set("category", e.target.value as EventCategory)}
          >
            {categories.map((c) => (
              <option key={c} value={c}>
                {CATEGORY_LABELS[c]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="startsAt">
            Starts
          </label>
          <input
            id="startsAt"
            type="datetime-local"
            required
            className="input"
            value={values.startsAt}
            onChange={(e) => set("startsAt", e.target.value)}
          />
        </div>
        <div>
          <label className="label" htmlFor="endsAt">
            Ends
          </label>
          <input
            id="endsAt"
            type="datetime-local"
            required
            className="input"
            value={values.endsAt}
            onChange={(e) => set("endsAt", e.target.value)}
          />
        </div>
      </div>
      <p className="-mt-2 text-[13px] text-muted">Times are in Philippine time.</p>

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={values.isOnline} onChange={(e) => set("isOnline", e.target.checked)} />
        It&apos;s online
      </label>

      <div className="grid gap-4 sm:grid-cols-[2fr_1fr]">
        <div>
          <label className="label" htmlFor="location">
            {values.isOnline ? "Meeting link" : "Venue and address"}
          </label>
          <input
            id="location"
            required
            type={values.isOnline ? "url" : "text"}
            placeholder={values.isOnline ? "https://" : "Lipa City Public Library, 2nd floor"}
            className="input"
            value={values.location}
            onChange={(e) => set("location", e.target.value)}
          />
          {values.isOnline && (
            <p className="mt-1 text-[13px] text-muted">Only people with a confirmed spot can see it.</p>
          )}
        </div>
        {!values.isOnline && (
          <div>
            <label className="label" htmlFor="city">
              City
            </label>
            <input id="city" required className="input" value={values.city} onChange={(e) => set("city", e.target.value)} />
          </div>
        )}
      </div>

      <div className="sm:w-40">
        <label className="label" htmlFor="capacity">
          Capacity
        </label>
        <input
          id="capacity"
          type="number"
          required
          min={1}
          max={5000}
          className="input"
          value={values.capacity}
          onChange={(e) => set("capacity", e.target.value)}
        />
      </div>
      {event && (
        <p className="text-[13px] text-muted">
          Raising the capacity moves people off the waitlist right away. If you change the time or place, everyone
          registered gets an email.
        </p>
      )}

      {error && (
        <p role="alert" className="text-sm text-bad">
          {error}
        </p>
      )}
      <div className="flex flex-wrap gap-2 border-t border-line pt-5">
        <button className="btn-primary" disabled={pending}>
          {event ? "Save changes" : "Publish"}
        </button>
        {!event && (
          <button type="button" className="btn-secondary" disabled={pending} onClick={() => submit(false)}>
            Save as draft
          </button>
        )}
        <button type="button" className="btn-secondary" onClick={() => router.back()}>
          Cancel
        </button>
      </div>
    </form>
  );
}

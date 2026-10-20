import Link from "next/link";
import { redirect } from "next/navigation";
import QRCode from "qrcode";
import { Suspense } from "react";
import { EventCard } from "@/components/event-card";
import { Column, FullBleed } from "@/components/full-bleed";
import { CATEGORY_COLOR, CATEGORY_LABELS } from "@/lib/categories";
import { SITE_URL } from "@/lib/config";
import { load, serverApi } from "@/lib/server-api";
import { formatTime, formatWeekdayDate } from "@/lib/time";
import { categories } from "@/server/db/schema";

export default function HomePage({ searchParams }: PageProps<"/">) {
  return (
    <>
      <Suspense>
        <OldBrowseLinks searchParams={searchParams} />
      </Suspense>

      <FullBleed className="photo photo-band -mt-8 text-hero-ink">
        <Column className="grid items-center gap-10 pt-6 pb-14 md:grid-cols-[1.1fr_1fr] md:pt-10 md:pb-20">
          <div>
            <h1 className="text-4xl leading-[1.05] font-semibold tracking-tight text-balance sm:text-5xl">
              What&apos;s on around Batangas
            </h1>
            <Suspense fallback={<p className="mt-4 h-14 max-w-md text-lg text-hero-muted" />}>
              <HeroCount />
            </Suspense>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link href="/events" className="btn bg-hero-ink text-hero hover:opacity-90">
                Browse events
              </Link>
              <Link href="/organize/new" className="btn border border-hero-muted/50 text-hero-ink hover:bg-white/10">
                Host an event
              </Link>
            </div>
          </div>
          <Suspense fallback={<div className="mx-auto h-[360px] w-full max-w-sm rounded-xl bg-white/5" />}>
            <NextUpTicket />
          </Suspense>
        </Column>
      </FullBleed>

      <section className="mt-14">
        <div className="mb-4 flex items-baseline justify-between gap-4">
          <h2 className="text-xl font-semibold tracking-tight">This week</h2>
          <Link href="/events" className="link text-sm">
            See all events
          </Link>
        </div>
        <Suspense fallback={<div className="h-72 rounded-lg bg-surface-2" />}>
          <ThisWeek />
        </Suspense>
      </section>

      <section className="mt-14">
        <h2 className="mb-4 text-xl font-semibold tracking-tight">Find your kind of thing</h2>
        <Suspense fallback={<div className="h-40 rounded-lg bg-surface-2" />}>
          <Categories />
        </Suspense>
      </section>

      <section className="mt-14 grid items-center gap-10 rounded-2xl border border-line bg-surface p-6 sm:p-10 md:grid-cols-2">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-balance">Running an event?</h2>
          <p className="mt-3 leading-relaxed text-muted">
            Post it, share the link, and let people register. When it fills up, a waitlist takes over and moves people
            up on its own if someone cancels.
          </p>
          <p className="mt-3 leading-relaxed text-muted">
            On the day, open the check-in page on your phone and scan tickets at the door. You&apos;ll see who&apos;s
            here, who isn&apos;t, and you can message everyone if plans change.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/organize/new" className="btn-primary">
              Create an event
            </Link>
            <Link href="/login?next=/organize" className="btn-secondary">
              See the organizer side
            </Link>
          </div>
        </div>
        <CheckInPreview />
      </section>
    </>
  );
}

// Browse used to live here, so old links like /?category=food still work.
async function OldBrowseLinks({ searchParams }: { searchParams: PageProps<"/">["searchParams"] }) {
  const sp = await searchParams;
  const params = new URLSearchParams();
  for (const key of ["q", "category", "when", "page"]) {
    const value = sp[key];
    if (typeof value === "string" && value) params.set(key, value);
  }
  if (params.size > 0) redirect(`/events?${params}`);
  return null;
}

async function HeroCount() {
  const client = await serverApi();
  const { total } = await load(client.api.events.overview.$get());
  return (
    <p className="mt-4 max-w-md text-lg leading-relaxed text-hero-muted">
      {total === 0
        ? "Nothing's posted yet. Be the first to put something on."
        : `${total} ${total === 1 ? "event" : "events"} in the next 30 days, from trail runs to coding workshops. Register in a click and show a QR code at the door.`}
    </p>
  );
}

// The next event with room left, drawn as a paper ticket. The QR code works:
// it opens the event page.
async function NextUpTicket() {
  const client = await serverApi();
  const { events } = await load(client.api.events.$get({ query: {} }));
  const event = events.find((e) => e.spotsLeft > 0) ?? events[0];
  if (!event) return null;
  const url = `${SITE_URL}/events/${event.slug}`;
  const qr = await QRCode.toString(url, {
    type: "svg",
    margin: 0,
    errorCorrectionLevel: "M",
    color: { dark: "#1d1b18", light: "#00000000" },
  });

  return (
    <Link
      href={`/events/${event.slug}`}
      className="group relative mx-auto block w-full max-w-sm animate-[rise_600ms_ease-out_both] text-[#1d1b18] drop-shadow-[0_24px_24px_rgba(0,0,0,0.35)] transition-transform md:-rotate-3 md:hover:rotate-0"
    >
      <div className="notch-bottom rounded-t-xl bg-paper p-6">
        <p className="text-xs font-semibold tracking-[0.18em] text-[#0f6b55] uppercase">Next up</p>
        <p className="mt-2 text-xl leading-snug font-semibold text-balance">{event.title}</p>
        <p className="mt-3 text-sm text-[#5d574f]">
          {formatWeekdayDate(event.startsAt)}, {formatTime(event.startsAt)}
          <br />
          {event.isOnline ? "Online" : event.city} · {event.organizerName}
        </p>
      </div>
      {/* Below the tear line. */}
      <div className="notch-top flex items-center gap-5 rounded-b-xl border-t-2 border-dashed border-[#d9d3c7] bg-paper p-6">
        <div className="h-24 w-24 shrink-0" aria-hidden="true" dangerouslySetInnerHTML={{ __html: qr }} />
        <div className="text-sm">
          <p className="font-medium">
            {event.spotsLeft > 0 ? `${event.spotsLeft} ${event.spotsLeft === 1 ? "spot" : "spots"} left` : "Waitlist open"}
          </p>
          <p className="mt-1 text-[#5d574f]">Scan it, or tap here, to see the event.</p>
        </div>
      </div>
    </Link>
  );
}

async function ThisWeek() {
  const client = await serverApi();
  const { events } = await load(client.api.events.$get({ query: { when: "week" } }));
  if (events.length === 0) {
    return (
      <p className="card p-6 text-sm text-muted">
        Nothing this week.{" "}
        <Link href="/events" className="link">
          See what&apos;s coming up later
        </Link>
        .
      </p>
    );
  }
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {events.slice(0, 4).map((event) => (
        <EventCard key={event.slug} event={event} />
      ))}
    </div>
  );
}

async function Categories() {
  const client = await serverApi();
  const { byCategory } = await load(client.api.events.overview.$get());
  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {categories.map((c) => {
        const count = byCategory[c] ?? 0;
        return (
          <li key={c}>
            <Link
              href={`/events?category=${c}`}
              className="card group lift flex h-full flex-col justify-between gap-6 p-4 hover:border-line-strong"
            >
              <span
                className="h-2.5 w-2.5 rounded-sm transition-[width] duration-200 group-hover:w-8"
                style={{ background: CATEGORY_COLOR[c] }}
                aria-hidden="true"
              />
              <span>
                <span className="block font-medium">{CATEGORY_LABELS[c]}</span>
                <span className="text-[13px] text-muted">
                  {count === 0 ? "Nothing yet" : `${count} coming up`}
                </span>
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

// A still of the check-in screen, built from the same pieces the real one uses.
function CheckInPreview() {
  const recent = [
    ["Joshua Garcia", "6:04 PM"],
    ["Camille Comia", "6:02 PM"],
    ["Rafael Reyes", "5:58 PM"],
  ];
  return (
    <div className="rounded-xl border border-line bg-bg p-4 sm:p-5" aria-label="Preview of the check-in screen" role="img">
      <div className="flex items-baseline justify-between text-sm">
        <span className="text-muted">Batangas Dev Meetup · Check-in</span>
        <span className="font-semibold tabular-nums">
          34 <span className="font-normal text-muted">of 47</span>
        </span>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-2">
        <div className="h-full w-[72%] rounded-full bg-accent" />
      </div>
      <div className="mt-4 rounded-lg border border-ok/30 bg-ok-soft p-4">
        <p className="text-sm font-medium text-ok">Checked in</p>
        <p className="mt-0.5 text-lg font-semibold">Andrea Santos</p>
        <p className="font-mono text-[13px] text-muted">QR239-9282R</p>
      </div>
      <ul className="mt-4 divide-y divide-line rounded-lg border border-line bg-surface text-sm">
        {recent.map(([name, time]) => (
          <li key={name} className="flex justify-between px-3 py-2">
            <span>{name}</span>
            <span className="text-muted tabular-nums">{time}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

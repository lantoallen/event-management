import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Badge } from "@/components/badges";
import { CapacityMeter } from "@/components/capacity-meter";
import { RegisterPanel } from "@/components/register-panel";
import { ShareButton } from "@/components/share-button";
import { CATEGORY_LABELS } from "@/lib/categories";
import { currentUser, load, serverApi } from "@/lib/server-api";
import { formatFullDate, formatTimeRange } from "@/lib/time";

export async function generateMetadata({ params }: PageProps<"/events/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const client = await serverApi();
  const res = await client.api.events[":slug"].$get({ param: { slug } });
  if (!res.ok) return { title: "Event not found" };
  const { event } = await res.json();
  return { title: event.title, description: event.summary };
}

export default function EventPage({ params }: PageProps<"/events/[slug]">) {
  return (
    <>
      <Link href="/" className="text-sm text-muted hover:text-ink">
        ← All events
      </Link>
      <Suspense fallback={<div className="mt-6 h-96 animate-pulse rounded-lg bg-surface-2" />}>
        <EventDetail params={params} />
      </Suspense>
    </>
  );
}

async function EventDetail({ params }: { params: PageProps<"/events/[slug]">["params"] }) {
  const { slug } = await params;
  const client = await serverApi();
  const [{ event }, user] = await Promise.all([
    load(client.api.events[":slug"].$get({ param: { slug } })),
    currentUser(),
  ]);
  const started = new Date(event.startsAt) <= new Date();

  return (
    <div className="mt-4 grid gap-8 md:grid-cols-[1fr_320px]">
      <article>
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted">
          <span>{CATEGORY_LABELS[event.category]}</span>
          {event.status === "draft" && <Badge tone="muted">Draft, only you can see this</Badge>}
          {event.status === "cancelled" && <Badge tone="bad">Cancelled</Badge>}
          {event.visibility === "unlisted" && <span>· Unlisted, only people with the link can see it</span>}
        </div>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight text-balance">{event.title}</h1>
        <p className="mt-2 text-muted">Hosted by {event.organizerName}</p>
        <p className="mt-6 text-lg leading-relaxed">{event.summary}</p>
        <div className="mt-4 space-y-4 leading-relaxed whitespace-pre-line text-ink/90">{event.description}</div>
      </article>

      <aside className="md:sticky md:top-6 md:self-start">
        <div className="card space-y-4 p-5">
          <div>
            <p className="font-medium">{formatFullDate(event.startsAt)}</p>
            <p className="text-sm text-muted">{formatTimeRange(event.startsAt, event.endsAt)}</p>
          </div>
          <div className="text-sm">
            {event.isOnline ? (
              event.location ? (
                <a href={event.location} className="link break-all">
                  {event.location}
                </a>
              ) : (
                <p>
                  Online. <span className="text-muted">The link shows up here once you have a spot.</span>
                </p>
              )
            ) : (
              <p>
                {event.location}
                <br />
                <span className="text-muted">{event.city}</span>
              </p>
            )}
          </div>
          <CapacityMeter taken={event.confirmed} capacity={event.capacity} waitlisted={event.waitlisted} />
          <RegisterPanel
            eventId={event.id}
            slug={event.slug}
            eventStatus={event.status}
            started={started}
            spotsLeft={event.spotsLeft}
            isOrganizer={event.isOrganizer}
            loggedIn={!!user}
            registration={event.registration}
          />
          {event.status === "published" && <ShareButton title={event.title} path={`/events/${event.slug}`} />}
        </div>
      </aside>
    </div>
  );
}

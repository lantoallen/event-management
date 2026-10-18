import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AttendeesTable } from "@/components/organizer/attendees-table";
import { EventActions } from "@/components/organizer/event-actions";
import { EventStatusBadge } from "@/components/organizer/event-status";
import { SignupChart } from "@/components/organizer/signup-chart";
import { load, serverApi } from "@/lib/server-api";
import { formatFullDate, formatTimeRange } from "@/lib/time";

export const metadata: Metadata = { title: "Manage event" };

export default function ManageEventPage({ params }: PageProps<"/organize/[id]">) {
  return (
    <>
      <Link href="/organize" className="text-sm text-muted hover:text-ink">
        ← Your events
      </Link>
      <Suspense fallback={<div className="mt-4 h-[600px] animate-pulse rounded-lg bg-surface-2" />}>
        <Dashboard params={params} />
      </Suspense>
    </>
  );
}

async function Dashboard({ params }: { params: PageProps<"/organize/[id]">["params"] }) {
  const { id } = await params;
  const client = await serverApi();
  const route = client.api.organizer.events[":id"];
  const returnTo = `/organize/${id}`;
  const [{ event }, { stats }, { attendees }] = await Promise.all([
    load(route.$get({ param: { id } }), { returnTo }),
    load(route.stats.$get({ param: { id } }), { returnTo }),
    load(route.attendees.$get({ param: { id } }), { returnTo }),
  ]);
  const ended = new Date(event.endsAt) <= new Date();

  return (
    <div className="mt-4 space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <EventStatusBadge status={event.status} endsAt={event.endsAt} />
          </div>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-balance">{event.title}</h1>
          <p className="mt-1 text-sm text-muted">
            {formatFullDate(event.startsAt)}, {formatTimeRange(event.startsAt, event.endsAt)} ·{" "}
            {event.isOnline ? "Online" : `${event.location}, ${event.city}`}
          </p>
        </div>
        <EventActions eventId={event.id} slug={event.slug} status={event.status} ended={ended} />
      </div>

      <dl className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Going" value={stats.confirmed} detail={`of ${stats.capacity} spots, ${Math.round(stats.fillRate * 100)}% full`} />
        <Stat label="Waitlist" value={stats.waitlisted} detail={stats.waitlisted ? "move up when people cancel" : "nobody waiting"} />
        <Stat
          label="Checked in"
          value={stats.checkedIn}
          detail={stats.confirmed ? `${Math.round(stats.checkInRate * 100)}% of people going` : "no one going yet"}
        />
        <Stat label="Cancelled" value={stats.cancelled} detail="gave up their spot" />
      </dl>

      <section className="card p-5">
        <h2 className="font-medium">Sign-ups per day</h2>
        <p className="text-[13px] text-muted">Registrations and waitlist joins, by the day they happened.</p>
        <SignupChart daily={stats.daily} />
      </section>

      <section>
        <AttendeesTable eventId={event.id} attendees={attendees} />
      </section>
    </div>
  );
}

function Stat({ label, value, detail }: { label: string; value: number; detail: string }) {
  return (
    <div className="card p-4">
      <dt className="text-[13px] text-muted">{label}</dt>
      <dd className="mt-1 text-2xl font-semibold tabular-nums">{value}</dd>
      <dd className="text-[13px] text-muted">{detail}</dd>
    </div>
  );
}

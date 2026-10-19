import type { InferResponseType } from "hono/client";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { TicketBadge } from "@/components/badges";
import type { api } from "@/lib/api";
import { load, serverApi } from "@/lib/server-api";
import { formatShortDate, formatTime, formatWeekdayDate } from "@/lib/time";

export const metadata: Metadata = { title: "My tickets" };

export default function TicketsPage() {
  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">My tickets</h1>
      <Suspense fallback={<div className="card mt-6 h-48 animate-pulse" />}>
        <TicketList />
      </Suspense>
    </>
  );
}

async function TicketList() {
  const client = await serverApi();
  const { tickets } = await load(client.api.me.tickets.$get(), { returnTo: "/tickets" });
  const now = new Date();
  const upcoming = tickets
    .filter((t) => new Date(t.event.endsAt) > now && t.event.status !== "cancelled")
    .sort((a, b) => a.event.startsAt.localeCompare(b.event.startsAt));
  const past = tickets.filter((t) => !upcoming.includes(t));

  if (tickets.length === 0) {
    return (
      <div className="card mt-6 p-8 text-center">
        <p className="font-medium">No tickets yet.</p>
        <p className="mt-1 text-sm text-muted">
          <Link href="/events" className="link">
            Find something to go to
          </Link>{" "}
          and your tickets will show up here.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-6 space-y-8">
      <TicketGroup title="Coming up" tickets={upcoming} empty="Nothing coming up." />
      {past.length > 0 && <TicketGroup title="Past and cancelled" tickets={past} />}
    </div>
  );
}

type Ticket = InferResponseType<typeof api.api.me.tickets.$get, 200>["tickets"][number];

function TicketGroup({ title, tickets, empty }: { title: string; tickets: Ticket[]; empty?: string }) {
  return (
    <section>
      <h2 className="mb-2 text-sm font-medium text-muted">{title}</h2>
      {tickets.length === 0 ? (
        <p className="text-sm text-muted">{empty}</p>
      ) : (
        <ul className="card divide-y divide-line">
          {tickets.map((t) => (
            <li key={t.ticketCode}>
              <Link
                href={t.status === "confirmed" ? `/tickets/${t.ticketCode}` : `/events/${t.event.slug}`}
                className="flex items-start gap-4 px-4 py-3 hover:bg-surface-2 sm:items-center"
              >
                {/* Wider screens get a date column. Phones put the date in the line
                    under the title so the title has the full width. */}
                <div className="hidden w-24 shrink-0 text-[13px] text-muted sm:block">
                  <div>{formatWeekdayDate(t.event.startsAt)}</div>
                  <div>{formatTime(t.event.startsAt)}</div>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-medium sm:truncate">{t.event.title}</p>
                  <p className="text-[13px] text-muted">
                    <span className="sm:hidden">
                      {formatWeekdayDate(t.event.startsAt)}, {formatTime(t.event.startsAt)} ·{" "}
                    </span>
                    {t.event.city}
                    {t.checkedInAt && ` · checked in ${formatShortDate(t.checkedInAt)}, ${formatTime(t.checkedInAt)}`}
                  </p>
                </div>
                <span className="shrink-0 pt-0.5 sm:pt-0">
                  <TicketBadge
                    status={t.status}
                    checkedInAt={t.checkedInAt}
                    waitlistPosition={t.waitlistPosition}
                    eventStatus={t.event.status}
                  />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

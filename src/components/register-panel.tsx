"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { api, errorMessage, unwrap } from "@/lib/api";
import { formatTicketCode } from "@/lib/tickets";
import { TicketNotches } from "./category-label";
import { WaitlistLine } from "./waitlist-line";

type Props = {
  eventId: string;
  slug: string;
  title: string;
  when: string;
  eventStatus: "draft" | "published" | "cancelled";
  started: boolean;
  spotsLeft: number;
  isOrganizer: boolean;
  loggedIn: boolean;
  registration: {
    status: "confirmed" | "waitlisted" | "cancelled";
    ticketCode: string;
    checkedInAt: string | null;
    waitlistPosition: number | null;
  } | null;
};

export function RegisterPanel(props: Props) {
  const { eventId, slug, title, when, eventStatus, started, spotsLeft, isOrganizer, loggedIn, registration } = props;
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  // What the person just did here, so the panel can show it happening once.
  const [joined, setJoined] = useState<"confirmed" | "waitlisted" | null>(null);

  function run(action: () => Promise<unknown>) {
    setError(null);
    start(async () => {
      try {
        await action();
        router.refresh();
      } catch (err) {
        setError(errorMessage(err));
      }
    });
  }

  const register = () =>
    run(async () => {
      const { registration } = await unwrap(api.api.events[":id"].registrations.$post({ param: { id: eventId } }));
      setJoined(registration.status === "waitlisted" ? "waitlisted" : "confirmed");
    });
  const cancel = (what: string) => {
    if (!window.confirm(what)) return;
    run(() => unwrap(api.api.events[":id"].registrations.me.$delete({ param: { id: eventId } })));
  };

  let body: React.ReactNode;
  if (isOrganizer) {
    body = (
      <>
        <p className="text-sm">You&apos;re hosting this event.</p>
        <Link href={`/organize/${eventId}`} className="btn-primary w-full">
          Manage event
        </Link>
      </>
    );
  } else if (eventStatus === "cancelled") {
    body = <p className="text-sm text-bad">The organizer cancelled this event.</p>;
  } else if (registration?.status === "confirmed") {
    body = (
      <>
        <p className="text-sm font-medium text-ok">
          {registration.checkedInAt ? "You're checked in." : joined === "confirmed" ? "You're going. Here's your ticket." : "You're going."}
        </p>
        {joined === "confirmed" && <PrintedTicket title={title} when={when} code={registration.ticketCode} />}
        <Link href={`/tickets/${registration.ticketCode}`} className="btn-primary w-full">
          Show my ticket
        </Link>
        {!started && (
          <button
            type="button"
            className="w-full text-center text-[13px] text-muted hover:text-bad"
            disabled={pending}
            onClick={() => cancel("Give up your spot? If there's a waitlist, the next person gets it.")}
          >
            Cancel my spot
          </button>
        )}
      </>
    );
  } else if (registration?.status === "waitlisted") {
    body = (
      <>
        <p className="text-sm">
          <span className="font-medium text-warn">You&apos;re number {registration.waitlistPosition} on the waitlist.</span>{" "}
          If someone cancels, you&apos;ll move up automatically and get an email.
        </p>
        <WaitlistLine position={registration.waitlistPosition ?? 1} justJoined={joined === "waitlisted"} />
        {!started && (
          <button type="button" className="btn-secondary w-full" disabled={pending} onClick={() => cancel("Leave the waitlist?")}>
            Leave the waitlist
          </button>
        )}
      </>
    );
  } else if (started) {
    body = <p className="text-sm text-muted">Registration closed when the event started.</p>;
  } else if (!loggedIn) {
    body = (
      <Link href={`/login?next=${encodeURIComponent(`/events/${slug}`)}`} className="btn-primary w-full">
        Log in to register
      </Link>
    );
  } else {
    body = (
      <>
        <button type="button" className="btn-primary w-full" disabled={pending} onClick={register}>
          {pending ? "Saving..." : spotsLeft > 0 ? "Register" : "Join the waitlist"}
        </button>
        {spotsLeft === 0 && (
          <p className="text-[13px] text-muted">It&apos;s full right now. People do cancel, and the waitlist moves up on its own.</p>
        )}
      </>
    );
  }

  return (
    // The tear line of the ticket: what you're signing up for above, the action below.
    <div className="relative space-y-3 border-t-2 border-dashed border-line pt-4">
      <TicketNotches inset={21} />
      {body}
      {error && (
        <p role="alert" className="text-sm text-bad">
          {error}
        </p>
      )}
    </div>
  );
}

// A ticket feeding out of a slot, a line at a time like a ticket printer.
// The real one, with the QR code, is on the ticket page.
function PrintedTicket({ title, when, code }: { title: string; when: string; code: string }) {
  return (
    <div aria-hidden="true">
      <div className="relative z-10 h-2 rounded-full bg-[#2b2925] dark:bg-black" />
      {/* The window under the slot opens a step at a time and shows the ticket's
          bottom edge first, so it looks like the ticket is feeding out. */}
      <div className="-mt-1 grid animate-[print_1.2s_steps(16,end)_both] px-3">
        <div className="flex min-h-0 flex-col justify-end overflow-hidden">
          <div className="rounded-b-md border border-t-0 border-[#d9d3c7] bg-paper px-4 pt-4 pb-3 text-[#1d1b18]">
            <p className="text-[10px] font-semibold tracking-[0.2em] text-[#0f6b55] uppercase">Admit one</p>
            <p className="mt-1 text-sm leading-snug font-semibold">{title}</p>
            <p className="text-xs text-[#5d574f]">{when}</p>
            <p className="mt-2 border-t border-dashed border-[#d9d3c7] pt-2 font-mono text-xs tracking-wider">
              {formatTicketCode(code)}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

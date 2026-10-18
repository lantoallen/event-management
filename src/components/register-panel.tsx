"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { api, errorMessage, unwrap } from "@/lib/api";

type Props = {
  eventId: string;
  slug: string;
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

export function RegisterPanel({ eventId, slug, eventStatus, started, spotsLeft, isOrganizer, loggedIn, registration }: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

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
    run(() => unwrap(api.api.events[":id"].registrations.$post({ param: { id: eventId } })));
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
          {registration.checkedInAt ? "You're checked in." : "You're going."}
        </p>
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
    <div className="space-y-3 border-t border-line pt-4">
      {body}
      {error && (
        <p role="alert" className="text-sm text-bad">
          {error}
        </p>
      )}
    </div>
  );
}

"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { api, errorMessage, unwrap } from "@/lib/api";

type Props = { eventId: string; slug: string; status: "draft" | "published" | "cancelled"; ended: boolean };

export function EventActions({ eventId, slug, status, ended }: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const route = api.api.organizer.events[":id"];
  const param = { param: { id: eventId } };

  function run(confirmText: string | null, action: () => Promise<unknown>, after?: () => void) {
    if (confirmText && !window.confirm(confirmText)) return;
    setError(null);
    start(async () => {
      try {
        await action();
        if (after) after();
        else router.refresh();
      } catch (err) {
        setError(errorMessage(err));
      }
    });
  }

  return (
    <div className="flex flex-col items-start gap-2 md:items-end">
      <div className="flex flex-wrap gap-2">
        {status === "published" && !ended && (
          <Link href={`/organize/${eventId}/check-in`} className="btn-primary">
            Check people in
          </Link>
        )}
        {status === "draft" && (
          <button
            type="button"
            className="btn-primary"
            disabled={pending}
            onClick={() => run(null, () => unwrap(route.publish.$post(param)))}
          >
            Publish
          </button>
        )}
        {status !== "cancelled" && !ended && (
          <Link href={`/organize/${eventId}/edit`} className="btn-secondary">
            Edit
          </Link>
        )}
        <Link href={`/events/${slug}`} className="btn-secondary">
          Public page
        </Link>
        <a href={`/api/organizer/events/${eventId}/attendees/export`} className="btn-secondary" download>
          Export CSV
        </a>
        {status === "published" && !ended && (
          <button
            type="button"
            className="btn-danger"
            disabled={pending}
            onClick={() =>
              run("Cancel this event? Everyone registered or on the waitlist gets an email. This can't be undone.", () =>
                unwrap(route.cancel.$post(param)),
              )
            }
          >
            Cancel event
          </button>
        )}
        {status === "draft" && (
          <button
            type="button"
            className="btn-danger"
            disabled={pending}
            onClick={() =>
              run(
                "Delete this draft?",
                () => unwrap(route.$delete(param)),
                () => {
                  router.push("/organize");
                  router.refresh();
                },
              )
            }
          >
            Delete
          </button>
        )}
      </div>
      {error && (
        <p role="alert" className="text-sm text-bad">
          {error}
        </p>
      )}
    </div>
  );
}

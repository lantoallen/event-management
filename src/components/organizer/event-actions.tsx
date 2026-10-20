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

  const link = "text-hero-ink underline-offset-2 hover:underline disabled:opacity-50";
  const live = status === "published" && !ended;

  return (
    <div className="flex flex-col items-start gap-3 md:shrink-0 md:items-end">
      {(live || status === "draft") && (
        <div className="flex flex-wrap gap-2">
          {live && (
            <Link href={`/organize/${eventId}/check-in`} className="btn bg-hero-ink text-hero hover:opacity-90">
              Check people in
            </Link>
          )}
          {status === "draft" && (
            <button
              type="button"
              className="btn bg-hero-ink text-hero hover:opacity-90"
              disabled={pending}
              onClick={() => run(null, () => unwrap(route.publish.$post(param)))}
            >
              Publish
            </button>
          )}
          <Link href={`/organize/${eventId}/edit`} className="btn border border-white/25 text-hero-ink hover:bg-white/10">
            Edit
          </Link>
        </div>
      )}
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm md:flex-nowrap">
        <Link href={`/events/${slug}`} className={link}>
          Public page
        </Link>
        <button
          type="button"
          className={link}
          disabled={pending}
          onClick={() =>
            run(
              null,
              async () => {
                const { event } = await unwrap(route.duplicate.$post(param));
                router.push(`/organize/${event.id}/edit`);
              },
              () => {},
            )
          }
        >
          Duplicate
        </button>
        <a href={`/api/organizer/events/${eventId}/attendees/export`} className={link} download>
          Export CSV
        </a>
        {live && (
          <button
            type="button"
            className="text-[#ffd6cf] hover:underline disabled:opacity-50"
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
            className="text-[#ffd6cf] hover:underline disabled:opacity-50"
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
            Delete draft
          </button>
        )}
      </div>
      {error && (
        <p role="alert" className="text-sm text-[#ffd6cf]">
          {error}
        </p>
      )}
    </div>
  );
}

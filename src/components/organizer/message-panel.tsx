"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { api, errorMessage, unwrap } from "@/lib/api";
import { formatDateTime } from "@/lib/time";
import type { SentMessage } from "@/lib/types";

export function MessagePanel({ eventId, messages, waitlisted }: { eventId: string; messages: SentMessage[]; waitlisted: number }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<number | null>(null);

  function send(form: FormData) {
    setError(null);
    start(async () => {
      try {
        const { message } = await unwrap(
          api.api.organizer.events[":id"].announcements.$post({
            param: { id: eventId },
            json: {
              subject: String(form.get("subject") ?? ""),
              body: String(form.get("body") ?? ""),
              includeWaitlist: form.get("waitlist") === "on",
            },
          }),
        );
        setSent(message.recipientCount);
        setOpen(false);
        router.refresh();
      } catch (err) {
        setError(errorMessage(err));
      }
    });
  }

  return (
    <section className="card p-5">
      <div className="flex items-center justify-between gap-4">
        <h2 className="font-medium">Messages</h2>
        {!open && (
          <button type="button" className="btn-secondary btn-sm" onClick={() => { setOpen(true); setSent(null); }}>
            Message attendees
          </button>
        )}
      </div>
      {sent !== null && (
        <p role="status" className="mt-2 text-sm text-ok">
          Sent to {sent} {sent === 1 ? "person" : "people"}.
        </p>
      )}

      {open && (
        <form action={send} className="mt-4 space-y-4">
          <div>
            <label className="label" htmlFor="subject">
              Subject
            </label>
            <input id="subject" name="subject" required maxLength={120} placeholder="We moved to Room 5" className="input" />
          </div>
          <div>
            <label className="label" htmlFor="body">
              Message
            </label>
            <textarea id="body" name="body" required rows={5} maxLength={5000} className="input h-auto py-2 leading-relaxed" />
          </div>
          {waitlisted > 0 && (
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="waitlist" /> Also send to the {waitlisted} {waitlisted === 1 ? "person" : "people"} on the waitlist
            </label>
          )}
          {error && (
            <p role="alert" className="text-sm text-bad">
              {error}
            </p>
          )}
          <div className="flex gap-2">
            <button className="btn-primary" disabled={pending}>
              {pending ? "Sending..." : "Send"}
            </button>
            <button type="button" className="btn-secondary" onClick={() => setOpen(false)}>
              Cancel
            </button>
          </div>
        </form>
      )}

      {messages.length === 0 ? (
        !open && <p className="mt-2 text-sm text-muted">Nothing sent yet. Messages go to everyone going, by email.</p>
      ) : (
        <ul className="mt-3 divide-y divide-line text-sm">
          {messages.map((m) => (
            <li key={m.id}>
              <details>
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-2.5">
                  <span className="truncate font-medium">{m.subject}</span>
                  <span className="shrink-0 text-[13px] text-muted">
                    {formatDateTime(m.createdAt)} · {m.recipientCount} {m.recipientCount === 1 ? "person" : "people"}
                  </span>
                </summary>
                <p className="pb-3 leading-relaxed whitespace-pre-line text-ink/90">{m.body}</p>
              </details>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

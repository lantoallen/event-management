import type { Metadata } from "next";
import { Suspense } from "react";
import { Badge } from "@/components/badges";
import { load, serverApi } from "@/lib/server-api";
import { formatDateTime } from "@/lib/time";

export const metadata: Metadata = { title: "Inbox" };

export default function InboxPage() {
  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">Inbox</h1>
      <p className="mt-1 max-w-2xl text-sm text-muted">
        Emails the app sends you: confirmations, waitlist updates, reminders. Since this is a demo, they land here
        instead of a real inbox.
      </p>
      <Suspense fallback={<div className="card mt-6 h-48 animate-pulse" />}>
        <Emails />
      </Suspense>
    </>
  );
}

async function Emails() {
  const client = await serverApi();
  const { emails } = await load(client.api.me.inbox.$get(), { returnTo: "/inbox" });
  if (emails.length === 0) {
    return <p className="card mt-6 p-8 text-center text-sm text-muted">Nothing yet. Register for an event and the confirmation shows up here.</p>;
  }
  return (
    <ul className="card mt-6 divide-y divide-line">
      {emails.map((email) => (
        <li key={email.id}>
          <details className="group">
            <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3 hover:bg-surface-2">
              <span className="min-w-0 flex-1 truncate font-medium">{email.subject}</span>
              {email.status === "failed" && <Badge tone="bad">Not delivered</Badge>}
              <span className="shrink-0 text-[13px] text-muted">{formatDateTime(email.createdAt)}</span>
            </summary>
            <div className="px-4 pt-1 pb-5 text-sm leading-relaxed whitespace-pre-line text-ink/90">{email.body}</div>
          </details>
        </li>
      ))}
    </ul>
  );
}

"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function Error({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="py-16 text-center">
      <h1 className="text-2xl font-semibold tracking-tight">Something went wrong on our side.</h1>
      <p className="mt-2 text-muted">It&apos;s usually temporary. Try again, or head back to the event list.</p>
      <div className="mt-6 flex justify-center gap-2">
        <button type="button" className="btn-primary" onClick={() => retry()}>
          Try again
        </button>
        <Link href="/events" className="btn-secondary">
          Browse events
        </Link>
      </div>
    </div>
  );
}

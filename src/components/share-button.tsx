"use client";

import { useState } from "react";

// Uses the phone's share sheet when there is one, otherwise copies the link.
export function ShareButton({ title, path }: { title: string; path: string }) {
  const [copied, setCopied] = useState(false);

  async function share() {
    const url = `${window.location.origin}${path}`;
    if (navigator.share) {
      try {
        await navigator.share({ title, url });
        return;
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
      }
    }
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <button type="button" onClick={share} className="w-full text-center text-[13px] text-muted hover:text-ink">
      {copied ? "Link copied" : "Share this event"}
    </button>
  );
}

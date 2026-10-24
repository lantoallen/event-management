"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { startsIn } from "@/lib/time";

// How long until the event starts, kept current while the page is open. When
// it starts or ends, the page reloads its data so the register panel catches
// up, since registration closes at the start.
export function Countdown({ startsAt, endsAt, initial }: { startsAt: string; endsAt: string; initial: string }) {
  const router = useRouter();
  const [label, setLabel] = useState(initial);
  const shown = useRef(initial);

  useEffect(() => {
    function tick() {
      const next = startsIn(startsAt, endsAt);
      if (next === shown.current) return;
      shown.current = next;
      setLabel(next);
      if (next === "Happening now" || next === "Ended") router.refresh();
    }
    tick();
    const timer = setInterval(tick, 15_000);
    return () => clearInterval(timer);
  }, [startsAt, endsAt, router]);

  // Keyed by the text, so each new value slides in like a departures board.
  const text = (
    <span key={label} className="inline-block animate-[flip-in_350ms_ease-out]">
      {label}
    </span>
  );
  if (label !== "Happening now") return <span>· {text}</span>;
  return (
    <span className="inline-flex items-center gap-1.5 font-medium text-hero-ink">
      <span className="relative flex h-2 w-2" aria-hidden="true">
        <span className="absolute inset-0 animate-ping rounded-full bg-[#8fdcc0] opacity-75" />
        <span className="relative h-2 w-2 rounded-full bg-[#8fdcc0]" />
      </span>
      {text}
    </span>
  );
}

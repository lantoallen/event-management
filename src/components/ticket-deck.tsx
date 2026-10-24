"use client";

import Link from "next/link";
import { useRef, useState } from "react";

export type DeckTicket = {
  slug: string;
  title: string;
  when: string;
  where: string;
  spots: string;
  qr: string;
};

// How far a ticket has to be dragged sideways before letting go throws it.
const THROW_PX = 70;

const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const tilt = () => (window.matchMedia("(min-width: 48rem)").matches ? -3 : 0);

// The next few events as a pile of paper tickets. Swipe the top one away, or
// use the arrows, and it goes to the back of the pile.
export function TicketDeck({ tickets }: { tickets: DeckTicket[] }) {
  const count = tickets.length;
  const [top, setTop] = useState(0);
  const [dragX, setDragX] = useState(0);
  const cards = useRef<(HTMLDivElement | null)[]>([]);
  const drag = useRef<{ startX: number } | null>(null);
  const dragged = useRef(false);

  // Plays a path for one card. The last keyframe is left out, so it ends
  // wherever its new place in the pile is.
  function fly(index: number, frames: Keyframe[]) {
    const card = cards.current[index];
    if (!card || reducedMotion()) return;
    card.animate(frames, { duration: 650, easing: "cubic-bezier(0.2, 0.7, 0.3, 1)" });
  }

  function next(side: -1 | 1 = -1, fromX = 0) {
    if (count < 2) return;
    const leaving = top;
    setTop((leaving + 1) % count);
    setDragX(0);
    fly(leaving, [
      { offset: 0, translate: `${fromX}px 0`, rotate: `${tilt() + fromX / 20}deg`, scale: "1", zIndex: 30 },
      { offset: 0.45, translate: `${side * 115}% -2%`, rotate: `${tilt() + side * 14}deg`, scale: "1", zIndex: 30 },
      { offset: 0.55, zIndex: 0 },
    ]);
  }

  function previous() {
    if (count < 2) return;
    const coming = (top - 1 + count) % count;
    const back = count - 1;
    setTop(coming);
    fly(coming, [
      {
        offset: 0,
        translate: `${back * 10}px ${back * 12}px`,
        rotate: `${tilt() + back * 3}deg`,
        scale: `${1 - back * 0.04}`,
        zIndex: 0,
      },
      { offset: 0.45, translate: "-115% -2%", rotate: `${tilt() - 14}deg`, scale: "1", zIndex: 0 },
      { offset: 0.55, zIndex: 30 },
    ]);
  }

  return (
    <div
      className="mx-auto w-full max-w-sm animate-[rise_600ms_ease-out_both]"
      onKeyDown={(e) => {
        if (e.key === "ArrowRight") next();
        if (e.key === "ArrowLeft") previous();
      }}
    >
      {/* Every ticket sits in the same grid cell; the ones behind peek out down and to the right. */}
      <div className="grid pr-5 pb-6">
        {tickets.map((ticket, i) => {
          const place = (i - top + count) % count;
          const isTop = place === 0;
          return (
            <div
              key={ticket.slug}
              ref={(el) => {
                cards.current[i] = el;
              }}
              className="deck-card touch-pan-y"
              data-top={isTop || undefined}
              inert={!isTop}
              style={{
                "--place": place,
                zIndex: count - place,
                ...(isTop && dragX ? { translate: `${dragX}px 0`, rotate: `${tilt() + dragX / 20}deg`, transition: "none" } : {}),
              } as React.CSSProperties}
              onPointerDown={(e) => {
                if (!isTop || e.button !== 0) return;
                drag.current = { startX: e.clientX };
                dragged.current = false;
              }}
              onPointerMove={(e) => {
                if (!drag.current) return;
                const dx = e.clientX - drag.current.startX;
                if (!dragged.current && Math.abs(dx) > 6) {
                  dragged.current = true;
                  e.currentTarget.setPointerCapture(e.pointerId);
                }
                if (dragged.current) setDragX(dx);
              }}
              onPointerUp={() => {
                if (!drag.current) return;
                drag.current = null;
                if (Math.abs(dragX) > THROW_PX) next(dragX < 0 ? -1 : 1, dragX);
                else setDragX(0);
              }}
              onPointerCancel={() => {
                drag.current = null;
                setDragX(0);
              }}
              onClickCapture={(e) => {
                // A drag that ends over the ticket isn't a tap on it.
                if (dragged.current) {
                  e.preventDefault();
                  dragged.current = false;
                }
              }}
            >
              <TicketFace ticket={ticket} first={i === 0} />
            </div>
          );
        })}
      </div>

      {count > 1 && (
        <div className="mt-1 flex items-center justify-center gap-3 pr-5 text-sm">
          <DeckButton label="Previous event" onClick={previous}>
            <path d="m15 6-6 6 6 6" />
          </DeckButton>
          <span className="min-w-12 text-center text-hero-ink tabular-nums">
            {top + 1} of {count}
          </span>
          <DeckButton label="Next event" onClick={() => next()}>
            <path d="m9 6 6 6-6 6" />
          </DeckButton>
          <p className="sr-only" aria-live="polite">
            {tickets[top].title}, {tickets[top].when}
          </p>
        </div>
      )}
    </div>
  );
}

function DeckButton({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="flex h-9 w-9 items-center justify-center rounded-full border border-white/25 bg-black/25 text-hero-ink transition-colors hover:bg-black/40 active:scale-95"
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        {children}
      </svg>
    </button>
  );
}

// A paper ticket. The QR code works: it opens the event page.
function TicketFace({ ticket, first }: { ticket: DeckTicket; first: boolean }) {
  return (
    <Link
      href={`/events/${ticket.slug}`}
      draggable={false}
      className="block text-[#1d1b18] drop-shadow-[0_24px_24px_rgba(0,0,0,0.35)] select-none"
    >
      <div className="notch-bottom rounded-t-xl bg-paper p-6">
        <p className="text-xs font-semibold tracking-[0.18em] text-[#0f6b55] uppercase">{first ? "Next up" : "Coming up"}</p>
        <p className="mt-2 text-xl leading-snug font-semibold text-balance">{ticket.title}</p>
        <p className="mt-3 text-sm text-[#5d574f]">
          {ticket.when}
          <br />
          {ticket.where}
        </p>
      </div>
      {/* Below the tear line. */}
      <div className="notch-top flex items-center gap-5 rounded-b-xl border-t-2 border-dashed border-[#d9d3c7] bg-paper p-6">
        <div className="h-24 w-24 shrink-0" aria-hidden="true" dangerouslySetInnerHTML={{ __html: ticket.qr }} />
        <div className="text-sm">
          <p className="font-medium">{ticket.spots}</p>
          <p className="mt-1 text-[#5d574f]">Scan it, or tap here, to see the event.</p>
        </div>
      </div>
    </Link>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import { formatShortDate, formatWeekdayDate } from "@/lib/time";

const HEIGHT = 140;
const BAR_MAX = 24;
const GAP = 2;
// Room on the left for the y-axis numbers.
const GUTTER = 28;

// Days are Manila calendar days ("2026-10-18"); noon keeps them on the right date.
const asDate = (day: string) => `${day}T12:00:00+08:00`;

export function SignupChart({ daily }: { daily: { day: string; count: number }[] }) {
  const [active, setActive] = useState<number | null>(null);
  // Drawn at the container's real width so the text stays 11px on phones.
  const boxRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(640);
  useEffect(() => {
    const box = boxRef.current;
    if (!box) return;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.max(240, Math.round(entry.contentRect.width))));
    observer.observe(box);
    return () => observer.disconnect();
  }, []);

  if (daily.length === 0) return <p className="mt-6 text-sm text-muted">No sign-ups yet.</p>;

  const max = Math.max(...daily.map((d) => d.count), 1);
  const top = niceCeil(max);
  const slot = (width - GUTTER) / daily.length;
  const bar = Math.max(2, Math.min(BAR_MAX, slot - GAP));
  const hovered = active === null ? null : daily[active];

  return (
    <div ref={boxRef} className="relative mt-4">
      <svg
        width={width}
        height={HEIGHT + 20}
        viewBox={`0 0 ${width} ${HEIGHT + 20}`}
        className="block max-w-full overflow-visible"
        role="img"
        aria-label={`Sign-ups per day, from ${formatShortDate(asDate(daily[0].day))} to ${formatShortDate(asDate(daily.at(-1)!.day))}. Highest was ${max} in a day.`}
        onPointerLeave={() => setActive(null)}
      >
        {[0.5, 1].map((f) => (
          <g key={f}>
            <line x1={GUTTER} x2={width} y1={HEIGHT - f * HEIGHT} y2={HEIGHT - f * HEIGHT} className="stroke-line" strokeWidth={1} />
            <text x={GUTTER - 8} y={HEIGHT - f * HEIGHT + 4} textAnchor="end" className="fill-muted text-[11px]">
              {Math.round(top * f)}
            </text>
          </g>
        ))}
        <line x1={GUTTER} x2={width} y1={HEIGHT} y2={HEIGHT} className="stroke-line-strong" strokeWidth={1} />
        {daily.map((d, i) => {
          const h = (d.count / top) * HEIGHT;
          const x = GUTTER + i * slot + (slot - bar) / 2;
          return (
            <g key={d.day}>
              {h > 0 && (
                <path
                  d={roundedTop(x, HEIGHT - h, bar, h, Math.min(4, bar / 2, h))}
                  className={active === i ? "fill-accent opacity-75" : "fill-accent"}
                />
              )}
              {/* Hit area: the whole column, not just the painted bar. */}
              <rect
                x={GUTTER + i * slot}
                y={0}
                width={slot}
                height={HEIGHT}
                fill="transparent"
                tabIndex={0}
                role="img"
                aria-label={`${formatWeekdayDate(asDate(d.day))}: ${d.count} sign-ups`}
                onPointerEnter={() => setActive(i)}
                onFocus={() => setActive(i)}
                onBlur={() => setActive(null)}
                className="outline-none"
              />
            </g>
          );
        })}
        <text x={GUTTER} y={HEIGHT + 16} className="fill-muted text-[11px]">
          {formatShortDate(asDate(daily[0].day))}
        </text>
        <text x={width} y={HEIGHT + 16} textAnchor="end" className="fill-muted text-[11px]">
          {formatShortDate(asDate(daily.at(-1)!.day))}
        </text>
      </svg>
      {hovered && active !== null && (
        <div
          className="pointer-events-none absolute top-0 -translate-x-1/2 rounded-md border border-line bg-surface px-2.5 py-1.5 text-[13px] shadow-sm"
          style={{ left: `${((GUTTER + (active + 0.5) * slot) / width) * 100}%` }}
        >
          <div className="text-muted">{formatWeekdayDate(asDate(hovered.day))}</div>
          <div className="font-medium tabular-nums">
            {hovered.count} {hovered.count === 1 ? "sign-up" : "sign-ups"}
          </div>
        </div>
      )}
      <details className="mt-3 text-[13px] text-muted">
        <summary className="cursor-pointer">Show as a table</summary>
        <table className="mt-2 w-full max-w-xs">
          <tbody>
            {daily.map((d) => (
              <tr key={d.day} className="border-b border-line">
                <td className="py-1">{formatWeekdayDate(asDate(d.day))}</td>
                <td className="py-1 text-right text-ink tabular-nums">{d.count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  );
}

function niceCeil(n: number) {
  if (n <= 4) return 4;
  const step = 10 ** Math.floor(Math.log10(n));
  return Math.ceil(n / (step / 2)) * (step / 2);
}

// A bar with rounded top corners and a square bottom on the baseline.
function roundedTop(x: number, y: number, w: number, h: number, r: number) {
  return `M${x},${y + h} V${y + r} Q${x},${y} ${x + r},${y} H${x + w - r} Q${x + w},${y} ${x + w},${y + r} V${y + h} Z`;
}

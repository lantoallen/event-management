"use client";

import type QrScanner from "qr-scanner";
import { useCallback, useEffect, useRef, useState } from "react";
import { api, ApiError, errorMessage, unwrap } from "@/lib/api";
import { formatTicketCode } from "@/lib/tickets";
import { formatTime } from "@/lib/time";
import type { RecentCheckIn } from "@/lib/types";

type Result =
  | { kind: "ok"; name: string; code: string; at: string }
  | { kind: "already"; name: string; code: string; at: string }
  | { kind: "error"; message: string };

type Props = {
  eventId: string;
  initial: { checkedIn: number; confirmed: number };
  initialRecent: RecentCheckIn[];
};

// The same QR is seen many times a second while it's in frame.
const REPEAT_MS = 4000;

export function CheckInDesk({ eventId, initial, initialRecent }: Props) {
  const route = api.api.organizer.events[":id"];
  const [counts, setCounts] = useState(initial);
  const [recent, setRecent] = useState(initialRecent);
  const [result, setResult] = useState<Result | null>(null);
  // Bumped on every scan so the stamp comes down again, even for the same ticket.
  const [scanCount, setScanCount] = useState(0);
  const [busy, setBusy] = useState(false);
  const [code, setCode] = useState("");
  const [camera, setCamera] = useState<"off" | "starting" | "on" | "unavailable">("off");

  const videoRef = useRef<HTMLVideoElement>(null);
  const scannerRef = useRef<QrScanner | null>(null);
  const lastScan = useRef({ value: "", at: 0 });
  const busyRef = useRef(false);

  const refreshRecent = useCallback(async () => {
    const data = await unwrap(route["check-ins"].$get({ param: { id: eventId } }));
    setRecent(data.recent);
  }, [eventId, route]);

  const submit = useCallback(
    async (raw: string) => {
      if (busyRef.current || !raw.trim()) return;
      busyRef.current = true;
      setBusy(true);
      try {
        const data = await unwrap(route["check-ins"].$post({ param: { id: eventId }, json: { code: raw } }));
        const entry = { name: data.attendee.name, code: data.attendee.ticketCode, at: data.checkedInAt };
        setResult(data.result === "checked_in" ? { kind: "ok", ...entry } : { kind: "already", ...entry });
        setScanCount((n) => n + 1);
        setCounts({ checkedIn: data.checkedIn, confirmed: data.confirmed });
        if (data.result === "checked_in") navigator.vibrate?.(60);
        setCode("");
        await refreshRecent();
      } catch (err) {
        setResult({ kind: "error", message: errorMessage(err) });
        setScanCount((n) => n + 1);
        if (err instanceof ApiError) navigator.vibrate?.([40, 60, 40]);
      } finally {
        busyRef.current = false;
        setBusy(false);
      }
    },
    [eventId, refreshRecent, route],
  );

  async function undo(ticketCode: string) {
    try {
      await unwrap(route["check-ins"][":code"].$delete({ param: { id: eventId, code: ticketCode } }));
      setResult(null);
      setCounts((c) => ({ ...c, checkedIn: Math.max(0, c.checkedIn - 1) }));
      lastScan.current = { value: "", at: 0 };
      await refreshRecent();
    } catch (err) {
      setResult({ kind: "error", message: errorMessage(err) });
    }
  }

  async function startCamera() {
    if (!videoRef.current) return;
    setCamera("starting");
    try {
      const { default: Scanner } = await import("qr-scanner");
      if (!(await Scanner.hasCamera())) {
        setCamera("unavailable");
        return;
      }
      const scanner = new Scanner(
        videoRef.current,
        ({ data }) => {
          const now = Date.now();
          if (data === lastScan.current.value && now - lastScan.current.at < REPEAT_MS) return;
          lastScan.current = { value: data, at: now };
          void submit(data);
        },
        { preferredCamera: "environment", highlightScanRegion: true, maxScansPerSecond: 8, returnDetailedScanResult: true },
      );
      scannerRef.current = scanner;
      await scanner.start();
      setCamera("on");
    } catch {
      setCamera("unavailable");
    }
  }

  function stopCamera() {
    scannerRef.current?.destroy();
    scannerRef.current = null;
    setCamera("off");
  }

  useEffect(() => () => scannerRef.current?.destroy(), []);

  const pct = counts.confirmed ? Math.round((counts.checkedIn / counts.confirmed) * 100) : 0;

  return (
    <div className="mt-5 space-y-4">
      <div className="card p-4">
        <div className="flex items-baseline justify-between">
          <p className="text-sm text-muted">Checked in</p>
          <p className="text-lg font-semibold tabular-nums" aria-live="polite">
            <span key={counts.checkedIn} className="inline-block animate-[bump_300ms_ease-out]">
              {counts.checkedIn}
            </span>{" "}
            <span className="text-sm font-normal text-muted">of {counts.confirmed}</span>
          </p>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-2">
          <div className="h-full rounded-full bg-accent transition-[width]" style={{ width: `${pct}%` }} />
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className={`relative bg-black ${camera === "on" || camera === "starting" ? "aspect-square sm:aspect-video" : "hidden"}`}>
          <video ref={videoRef} className="h-full w-full object-cover" muted playsInline />
        </div>
        <div className="flex flex-wrap items-center gap-2 p-4">
          {camera === "on" ? (
            <button type="button" className="btn-secondary" onClick={stopCamera}>
              Stop camera
            </button>
          ) : (
            <button type="button" className="btn-primary" disabled={camera === "starting"} onClick={startCamera}>
              {camera === "starting" ? "Starting camera..." : "Scan with camera"}
            </button>
          )}
          <p className="text-[13px] text-muted">
            {camera === "unavailable"
              ? "Couldn't open a camera here. Type the code from the ticket instead."
              : "Point it at the QR code on someone's ticket."}
          </p>
        </div>
        <form
          className="flex gap-2 border-t border-line p-4"
          onSubmit={(e) => {
            e.preventDefault();
            void submit(code);
          }}
        >
          <label htmlFor="code" className="sr-only">
            Ticket code
          </label>
          <input
            id="code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="Ticket code, like ABCDE-23456"
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            className="input font-mono uppercase placeholder:font-sans placeholder:normal-case"
          />
          <button className="btn-secondary" disabled={busy || !code.trim()}>
            Check in
          </button>
        </form>
      </div>

      <div aria-live="assertive">{result && <ResultCard key={scanCount} result={result} onUndo={undo} />}</div>

      <section>
        <h2 className="mb-2 text-sm font-medium text-muted">Latest check-ins</h2>
        {recent.length === 0 ? (
          <p className="text-sm text-muted">Nobody yet.</p>
        ) : (
          <ul className="card divide-y divide-line text-sm">
            {recent.map((r) => (
              <li key={r.ticketCode} className="flex items-center justify-between gap-3 px-4 py-2.5">
                <span className="truncate">{r.name}</span>
                <span className="shrink-0 text-[13px] text-muted tabular-nums">{r.checkedInAt && formatTime(r.checkedInAt)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function ResultCard({ result, onUndo }: { result: Result; onUndo: (code: string) => void }) {
  if (result.kind === "error") {
    return (
      <div role="alert" className="relative animate-[shake_400ms_ease-in-out] overflow-hidden rounded-lg border border-bad/30 bg-bad-soft p-4">
        <div className="pr-32">
          <p className="font-medium text-bad">Not checked in</p>
          <p className="mt-0.5 text-sm">{result.message}</p>
        </div>
        <Stamp tone="bad">No entry</Stamp>
      </div>
    );
  }
  const ok = result.kind === "ok";
  return (
    <div className={`relative overflow-hidden rounded-lg border p-4 ${ok ? "border-ok/30 bg-ok-soft" : "border-warn/30 bg-warn-soft"}`}>
      <Stamp tone={ok ? "ok" : "warn"}>{ok ? "Admitted" : "Already in"}</Stamp>
      <div className="relative flex items-start justify-between gap-3">
        <div className="pr-28">
          <p className={`font-medium ${ok ? "text-ok" : "text-warn"}`}>
            {ok ? "Checked in" : `Already checked in at ${formatTime(result.at)}`}
          </p>
          <p className="mt-0.5 text-lg font-semibold">{result.name}</p>
          <p className="font-mono text-[13px] text-muted">{formatTicketCode(result.code)}</p>
        </div>
        {ok && (
          <button type="button" className="btn-secondary btn-sm" onClick={() => onUndo(result.code)}>
            Undo
          </button>
        )}
      </div>
    </div>
  );
}

// A rubber stamp that thumps down on the result, like the ones at a real door.
function Stamp({ tone, children }: { tone: "ok" | "warn" | "bad"; children: React.ReactNode }) {
  const ink = { ok: "border-ok text-ok", warn: "border-warn text-warn", bad: "border-bad text-bad" }[tone];
  return (
    <span
      aria-hidden="true"
      className={`pointer-events-none absolute right-4 bottom-3 -rotate-12 animate-[stamp_450ms_cubic-bezier(0.2,0.9,0.3,1.3)_both] rounded-md border-[3px] px-2 py-0.5 font-mono text-[13px] font-bold tracking-[0.18em] uppercase ${ink}`}
    >
      {children}
    </span>
  );
}

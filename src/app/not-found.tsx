import Link from "next/link";

export default function NotFound() {
  return (
    <div className="py-16 text-center">
      <h1 className="text-2xl font-semibold tracking-tight">We couldn&apos;t find that.</h1>
      <p className="mt-2 text-muted">The link might be old, or the event was removed.</p>
      <Link href="/events" className="btn-secondary mt-6">
        Browse events
      </Link>
    </div>
  );
}

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/events", label: "Browse" },
  { href: "/tickets", label: "My tickets", short: "Tickets" },
  { href: "/inbox", label: "Inbox" },
  { href: "/organize", label: "Organize" },
];

function isActive(href: string, pathname: string) {
  return pathname.startsWith(href);
}

// Rendered without a pathname while the page streams in, then with it.
export function NavLinks({ pathname, compact = false }: { pathname: string | null; compact?: boolean }) {
  return LINKS.map(({ href, label, short }) => {
    const active = pathname !== null && isActive(href, pathname);
    return (
      <Link
        key={href}
        href={href}
        aria-current={active ? "page" : undefined}
        className={`shrink-0 rounded-md px-2.5 py-1.5 ${active ? "bg-white/10 text-hero-ink" : "text-hero-muted hover:text-hero-ink"}`}
      >
        {compact ? (short ?? label) : label}
      </Link>
    );
  });
}

export function CurrentNav({ compact = false }: { compact?: boolean }) {
  return <NavLinks pathname={usePathname()} compact={compact} />;
}

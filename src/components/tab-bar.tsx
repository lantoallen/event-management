"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/", label: "Home", icon: <path d="M4 10.5 12 4l8 6.5V19a1 1 0 0 1-1 1h-4.5v-5.5h-5V20H5a1 1 0 0 1-1-1z" /> },
  {
    href: "/events",
    label: "Browse",
    icon: (
      <>
        <rect x="4" y="5.5" width="16" height="14.5" rx="2" />
        <path d="M4 10h16M8.5 3.5v4M15.5 3.5v4" />
      </>
    ),
  },
  {
    href: "/tickets",
    label: "Tickets",
    icon: (
      <>
        <path d="M4 7a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v2.5a2.5 2.5 0 0 0 0 5V17a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-2.5a2.5 2.5 0 0 0 0-5z" />
        <path d="M14.5 6.5v11" strokeDasharray="1.5 2.2" />
      </>
    ),
  },
  {
    href: "/inbox",
    label: "Inbox",
    icon: (
      <>
        <rect x="3.5" y="5.5" width="17" height="13" rx="1.5" />
        <path d="m4 7 8 6 8-6" />
      </>
    ),
  },
  {
    href: "/organize",
    label: "Organize",
    icon: (
      <>
        <rect x="5" y="4.5" width="14" height="16" rx="2" />
        <path d="M9.5 3.5h5v2.5h-5zM9 11h6M9 15h4" />
      </>
    ),
  },
];

function isActive(href: string, pathname: string) {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

// The phone navigation, along the bottom of the screen where a thumb reaches.
// Rendered without a pathname while the page streams in, then with it.
export function TabLinks({ pathname }: { pathname: string | null }) {
  return TABS.map(({ href, label, icon }) => {
    const active = pathname !== null && isActive(href, pathname);
    return (
      <Link
        key={href}
        href={href}
        aria-current={active ? "page" : undefined}
        className={`relative flex h-14 flex-1 flex-col items-center justify-center gap-0.5 text-[11px] active:bg-surface-2 ${active ? "font-medium text-accent" : "text-muted"}`}
      >
        {active && <span className="absolute inset-x-5 top-0 h-0.5 rounded-b bg-accent" />}
        <svg
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          {icon}
        </svg>
        {label}
      </Link>
    );
  });
}

export function CurrentTabs() {
  return <TabLinks pathname={usePathname()} />;
}

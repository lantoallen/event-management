import Link from "next/link";
import { Suspense } from "react";
import { APP_NAME } from "@/lib/config";
import { currentUser } from "@/lib/server-api";
import { LogoutButton } from "./logout-button";
import { CurrentNav, NavLinks } from "./nav";

export function SiteHeader() {
  return (
    <header className="border-b border-line bg-surface">
      <div className="mx-auto flex h-14 max-w-5xl items-center gap-6 px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
          <TicketMark />
          {APP_NAME}
        </Link>
        <nav className="hidden items-center gap-1 text-sm sm:flex">
          <Suspense fallback={<NavLinks pathname={null} />}>
            <CurrentNav />
          </Suspense>
        </nav>
        <div className="ml-auto flex items-center gap-3 text-sm">
          <Suspense fallback={<span className="h-8 w-20" />}>
            <Account />
          </Suspense>
        </div>
      </div>
      <nav className="flex gap-1 overflow-x-auto border-t border-line px-2 py-1.5 text-sm sm:hidden">
        <Suspense fallback={<NavLinks pathname={null} compact />}>
          <CurrentNav compact />
        </Suspense>
      </nav>
    </header>
  );
}

async function Account() {
  const user = await currentUser();
  if (!user) {
    return (
      <>
        <Link href="/login" className="text-muted hover:text-ink">
          Log in
        </Link>
        <Link href="/signup" className="btn-primary btn-sm">
          Sign up
        </Link>
      </>
    );
  }
  return (
    <>
      <span className="hidden max-w-40 truncate text-muted md:inline">{user.name}</span>
      <LogoutButton />
    </>
  );
}

function TicketMark() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true" className="text-accent">
      <path
        fill="currentColor"
        d="M4 5h16a1 1 0 0 1 1 1v3.2a2.8 2.8 0 0 0 0 5.6V18a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-3.2a2.8 2.8 0 0 0 0-5.6V6a1 1 0 0 1 1-1Zm10 2v2h1.5V7H14Zm0 4v2h1.5v-2H14Zm0 4v2h1.5v-2H14Z"
      />
    </svg>
  );
}

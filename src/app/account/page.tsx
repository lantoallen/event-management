import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { AccountForms } from "@/components/account-forms";
import { currentUser } from "@/lib/server-api";

export const metadata: Metadata = { title: "Account" };

export default function AccountPage() {
  return (
    <div className="mx-auto max-w-xl">
      <h1 className="text-2xl font-semibold tracking-tight">Account</h1>
      <Suspense fallback={<div className="card mt-6 h-96 animate-pulse" />}>
        <Account />
      </Suspense>
    </div>
  );
}

async function Account() {
  const user = await currentUser();
  if (!user) redirect("/login?next=/account");
  return <AccountForms user={user} />;
}

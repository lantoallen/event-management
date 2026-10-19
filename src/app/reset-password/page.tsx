import type { Metadata } from "next";
import { Suspense } from "react";
import { ResetPasswordForm } from "@/components/password-forms";

export const metadata: Metadata = { title: "Set a new password" };

export default function Page() {
  return (
    <div className="mx-auto max-w-sm">
      <h1 className="text-2xl font-semibold tracking-tight">Set a new password</h1>
      <Suspense>
        <ResetPasswordForm />
      </Suspense>
    </div>
  );
}

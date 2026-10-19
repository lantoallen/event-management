import type { Metadata } from "next";
import { ForgotPasswordForm } from "@/components/password-forms";

export const metadata: Metadata = { title: "Forgot password" };

export default function Page() {
  return (
    <div className="mx-auto max-w-sm">
      <h1 className="text-2xl font-semibold tracking-tight">Forgot your password?</h1>
      <p className="mt-1 text-sm text-muted">Enter your email and we&apos;ll send you a link to set a new one.</p>
      <ForgotPasswordForm />
    </div>
  );
}

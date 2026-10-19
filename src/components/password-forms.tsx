"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { api, errorMessage, unwrap } from "@/lib/api";

export function ForgotPasswordForm() {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ emailEnabled: boolean } | null>(null);

  function submit(form: FormData) {
    setError(null);
    start(async () => {
      try {
        setResult(await unwrap(api.api.auth.forgot.$post({ json: { email: String(form.get("email") ?? "") } })));
      } catch (err) {
        setError(errorMessage(err));
      }
    });
  }

  if (result?.emailEnabled) {
    return (
      <p className="mt-6 text-sm">
        If there&apos;s an account with that email, we&apos;ve sent it a link to set a new password. The link works for
        an hour. Check your spam folder if it doesn&apos;t show up in a few minutes.
      </p>
    );
  }
  if (result) {
    return (
      <p className="mt-6 text-sm">
        Email isn&apos;t set up on this site yet, so reset links can&apos;t be sent. Ask the site&apos;s admin to add an
        email service.
      </p>
    );
  }

  return (
    <form action={submit} className="mt-6 space-y-4">
      <div>
        <label className="label" htmlFor="email">
          Email
        </label>
        <input id="email" name="email" type="email" required autoComplete="email" className="input" />
      </div>
      {error && (
        <p role="alert" className="text-sm text-bad">
          {error}
        </p>
      )}
      <button className="btn-primary w-full" disabled={pending}>
        Send reset link
      </button>
      <p className="text-sm text-muted">
        Remembered it?{" "}
        <Link href="/login" className="link">
          Log in
        </Link>
      </p>
    </form>
  );
}

export function ResetPasswordForm() {
  const router = useRouter();
  const token = useSearchParams().get("token") ?? "";
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (!token) {
    return (
      <p className="mt-6 text-sm">
        This link is missing its code. Use the link from the email exactly as it was sent, or{" "}
        <Link href="/forgot-password" className="link">
          ask for a new one
        </Link>
        .
      </p>
    );
  }

  function submit(form: FormData) {
    setError(null);
    const password = String(form.get("password") ?? "");
    if (password !== String(form.get("confirm") ?? "")) {
      setError("The two passwords don't match.");
      return;
    }
    start(async () => {
      try {
        await unwrap(api.api.auth.reset.$post({ json: { token, password } }));
        router.push("/");
        router.refresh();
      } catch (err) {
        setError(errorMessage(err));
      }
    });
  }

  return (
    <form action={submit} className="mt-6 space-y-4">
      <div>
        <label className="label" htmlFor="password">
          New password
        </label>
        <input id="password" name="password" type="password" required minLength={8} autoComplete="new-password" className="input" />
        <p className="mt-1 text-[13px] text-muted">At least 8 characters.</p>
      </div>
      <div>
        <label className="label" htmlFor="confirm">
          Type it again
        </label>
        <input id="confirm" name="confirm" type="password" required minLength={8} autoComplete="new-password" className="input" />
      </div>
      {error && (
        <p role="alert" className="text-sm text-bad">
          {error}{" "}
          {error.includes("expired") && (
            <Link href="/forgot-password" className="link">
              Get a new link
            </Link>
          )}
        </p>
      )}
      <button className="btn-primary w-full" disabled={pending}>
        Set new password
      </button>
    </form>
  );
}

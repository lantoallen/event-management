"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { api } from "@/lib/api";

export function LogoutButton() {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      className="btn btn-sm border border-white/25 text-hero-ink hover:bg-white/10"
      disabled={pending}
      onClick={() =>
        start(async () => {
          await api.api.auth.logout.$post();
          router.push("/");
          router.refresh();
        })
      }
    >
      Log out
    </button>
  );
}

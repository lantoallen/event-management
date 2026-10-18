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
      className="btn-secondary btn-sm"
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

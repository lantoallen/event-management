"use client";

import { useEffect } from "react";

// Pressing "/" anywhere jumps to the search box on screen, like GitHub and
// YouTube, unless you're already typing in a field.
export function SearchShortcut() {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== "/" || e.metaKey || e.ctrlKey || e.altKey) return;
      const target = e.target as HTMLElement;
      if (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) return;
      const field = [...document.querySelectorAll<HTMLInputElement>("[data-search]")].find((el) => el.offsetParent !== null);
      if (!field) return;
      e.preventDefault();
      field.focus();
      field.select();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);
  return null;
}

// Where to send someone after they log in, if `?next=` asked for somewhere.
// Resolving it as a URL (instead of checking how the string starts) catches
// tricks like "/\evil.com", which browsers read as "//evil.com", another site.
// The origin is a placeholder: anything that resolves elsewhere isn't ours.
const HERE = "https://this-site.invalid";

export function safeRedirectPath(value: string | null | undefined) {
  if (!value) return null;
  try {
    const url = new URL(value, HERE);
    return url.origin === HERE ? url.pathname + url.search + url.hash : null;
  } catch {
    return null;
  }
}

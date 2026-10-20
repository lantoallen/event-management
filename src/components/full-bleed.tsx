// Stretches a band to the full window width from inside the centered page
// column. The body clips the sideways overflow this would otherwise cause.
export function FullBleed({ className = "", children }: { className?: string; children: React.ReactNode }) {
  return <div className={`relative left-1/2 w-screen -translate-x-1/2 ${className}`}>{children}</div>;
}

// The page column, for content inside a full-width band.
export function Column({ className = "", children }: { className?: string; children: React.ReactNode }) {
  return <div className={`mx-auto w-full max-w-5xl px-4 sm:px-6 ${className}`}>{children}</div>;
}

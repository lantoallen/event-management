import { Column, FullBleed } from "./full-bleed";

// The green band under the header that inner pages open with.
export function PageBand({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <FullBleed className="-mt-8 mb-8 bg-hero text-hero-ink">
      <Column className="flex flex-wrap items-end justify-between gap-4 pt-4 pb-8 md:pt-6 md:pb-10">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{title}</h1>
        {children}
      </Column>
    </FullBleed>
  );
}

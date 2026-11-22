import { Button } from "@quack/ui/components/button";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { useEffect } from "react";

type Props = {
  variants: { id: string; label: string }[];
  scenarios: readonly string[];
  variant: string;
  scenario: string;
  onChange: (next: { variant: string; scenario: string }) => void;
};

const editing = (target: EventTarget | null) =>
  target instanceof HTMLElement &&
  (target.matches("input, textarea, select") || target.isContentEditable);

/** Throwaway: cycles design variants. Renders nothing in a production build. */
export function PrototypeSwitcher({ variants, scenarios, variant, scenario, onChange }: Props) {
  const index = variants.findIndex((v) => v.id === variant);
  const cycle = (step: number) => {
    const next = variants[(index + step + variants.length) % variants.length];
    if (next !== undefined) onChange({ variant: next.id, scenario });
  };

  useEffect(() => {
    if (import.meta.env.PROD) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey || editing(event.target)) return;
      if (event.key === "ArrowLeft") cycle(-1);
      if (event.key === "ArrowRight") cycle(1);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  if (import.meta.env.PROD) return null;
  const current = variants[index];

  return (
    <div
      role="group"
      aria-label="Prototype switcher (not part of the design)"
      className="fixed bottom-4 left-1/2 z-50 flex -translate-x-1/2 items-center gap-1 rounded-full border-2 border-dashed border-fuchsia-500 bg-fuchsia-950 py-1 pr-3 pl-1 text-xs text-fuchsia-50 shadow-lg"
    >
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label="Previous variant"
        onClick={() => cycle(-1)}
      >
        <ChevronLeftIcon aria-hidden />
      </Button>
      <span className="min-w-36 text-center font-mono font-medium" aria-live="polite">
        {variant} ({current?.label})
      </span>
      <Button variant="ghost" size="icon-sm" aria-label="Next variant" onClick={() => cycle(1)}>
        <ChevronRightIcon aria-hidden />
      </Button>
      <span aria-hidden className="mx-1 h-4 w-px bg-fuchsia-400/50" />
      <label className="flex items-center gap-1">
        <span className="font-mono">scenario</span>
        <select
          className="rounded bg-fuchsia-900 px-1 py-0.5 font-mono"
          value={scenario}
          onChange={(event) => onChange({ variant, scenario: event.target.value })}
        >
          {scenarios.map((id) => (
            <option key={id} value={id}>
              {id}
            </option>
          ))}
        </select>
      </label>
      <span className="ml-2 rounded-full bg-fuchsia-500 px-2 py-0.5 font-mono font-bold text-white uppercase">
        prototype
      </span>
    </div>
  );
}

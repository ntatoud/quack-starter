import { Skeleton } from "@quack/ui/components/skeleton";

/** What a list shows while it loads: its rows drawn as skeletons, and `label` said to a screen reader. */
export function ListLoading({ label }: { label: string }) {
  return (
    <>
      <p role="status" className="sr-only">
        {label}
      </p>
      <ul className="divide-y rounded-xl border" aria-hidden="true">
        {[0, 1, 2].map((row) => (
          <li key={row} className="flex h-11 items-center gap-3 px-5">
            <Skeleton className="size-4" />
            <Skeleton className="h-4 w-1/2" />
          </li>
        ))}
      </ul>
    </>
  );
}

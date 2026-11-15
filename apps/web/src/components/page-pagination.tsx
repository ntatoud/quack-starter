import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
} from "@quack/ui/components/pagination";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { PageNumber } from "@quack/contracts/pagination/paginated";
import { Effect, Option, Schema } from "effect";
import { type MouseEvent, useEffect, useRef } from "react";

import { ButtonLink } from "#/components/button-link.tsx";

// Replaced, not dropped: the router keeps the raw value of a key that validation drops.
export const PageSearch = Schema.Struct({
  page: Schema.optional(
    PageNumber.pipe(Schema.catchDecoding(() => Effect.succeed(Option.some(1)))),
  ),
});

// The router matches a search partly by default: without `page`, the first page would be active on every page.
const step = { to: ".", variant: "ghost", activeOptions: { exact: true } } as const;

// The first page has no `page`, so a page has one URL.
const withPage =
  (page: number) =>
  ({ page: _, ...rest }: Record<string, unknown>) =>
    page === 1 ? rest : { ...rest, page };

export const pageCount = (total: number, pageSize: number) =>
  Math.max(1, Math.ceil(total / pageSize));

export const pagesAround = (
  page: number,
  pages: number,
): ReadonlyArray<number | "gap-before" | "gap-after"> => {
  const shown = [...new Set([1, page - 1, page, page + 1, pages])]
    .filter((n) => n >= 1 && n <= pages)
    .toSorted((a, b) => a - b);
  return shown.flatMap((n, i) => {
    const gap = i === 0 ? 0 : n - (shown[i - 1] ?? n) - 1;
    if (gap === 0) return [n];
    if (gap === 1) return [n - 1, n];
    return [n <= page ? ("gap-before" as const) : ("gap-after" as const), n];
  });
};

export function PagePagination({
  page,
  pages,
  "aria-label": label,
}: {
  page: number;
  pages: number;
  "aria-label": string;
}) {
  const currentLink = useRef<HTMLAnchorElement>(null);
  // Previous or Next, disabled once it reaches its end, can no longer hold the focus it had.
  const refocusOn = useRef<number | null>(null);
  useEffect(() => {
    const target = refocusOn.current;
    refocusOn.current = null;
    if (target === page) currentLink.current?.focus();
  }, [page]);
  // A click with a modifier opens another tab and leaves this page where it is.
  const keepFocusOn = (target: number) => (event: MouseEvent) => {
    if (event.button === 0 && !(event.metaKey || event.ctrlKey || event.shiftKey || event.altKey))
      refocusOn.current = target;
  };

  const previous = Math.min(page - 1, pages);
  const next = page + 1;

  return (
    <div className="flex flex-col items-center gap-2 @xl:flex-row @xl:justify-between">
      <p aria-live="polite" className="shrink-0 whitespace-nowrap text-muted-foreground">
        Page {page} of {pages}
      </p>
      <Pagination aria-label={label} className="mx-0 w-auto">
        <PaginationContent>
          <PaginationItem>
            <ButtonLink
              {...step}
              search={withPage(previous)}
              disabled={previous < 1}
              onClick={previous === 1 ? keepFocusOn(1) : undefined}
              aria-label="Go to previous page"
              className="pl-1.5"
            >
              <ChevronLeftIcon data-icon="inline-start" />
              <span className="hidden @md:block">Previous</span>
            </ButtonLink>
          </PaginationItem>
          {pagesAround(page, pages).map((n) =>
            typeof n === "string" ? (
              <PaginationItem key={n}>
                <PaginationEllipsis />
              </PaginationItem>
            ) : (
              <PaginationItem key={n}>
                <ButtonLink
                  {...step}
                  ref={n === page ? currentLink : undefined}
                  search={withPage(n)}
                  aria-current={n === page ? "page" : undefined}
                  variant={n === page ? "outline" : "ghost"}
                  size="icon"
                  aria-label={`Page ${n}`}
                >
                  {n}
                </ButtonLink>
              </PaginationItem>
            ),
          )}
          <PaginationItem>
            <ButtonLink
              {...step}
              search={withPage(next)}
              disabled={page >= pages}
              onClick={next === pages ? keepFocusOn(pages) : undefined}
              aria-label="Go to next page"
              className="pr-1.5"
            >
              <span className="hidden @md:block">Next</span>
              <ChevronRightIcon data-icon="inline-end" />
            </ButtonLink>
          </PaginationItem>
        </PaginationContent>
      </Pagination>
    </div>
  );
}

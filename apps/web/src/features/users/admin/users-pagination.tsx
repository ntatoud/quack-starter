import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
} from "@quack/ui/components/pagination";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { type MouseEvent, useEffect, useRef } from "react";

import { ButtonLink } from "#/components/button-link.tsx";

// The router matches a search partly by default: `{}`, the first page, would be active on every page.
const step = { to: "/users", variant: "ghost", activeOptions: { exact: true } } as const;

const searchOf = (page: number) => (page === 1 ? {} : { page });

/** The first page, the last, and those next to the current one; a gap of more than one page is an ellipsis. */
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

export function UsersPagination({ page, pages }: { page: number; pages: number }) {
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
    <Pagination aria-label="Pages of users" className="mx-0 w-auto">
      <PaginationContent>
        <PaginationItem>
          <ButtonLink
            {...step}
            search={searchOf(previous)}
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
                search={searchOf(n)}
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
            search={searchOf(next)}
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
  );
}

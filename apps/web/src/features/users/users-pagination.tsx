import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
} from "@quack/ui/components/pagination";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { useEffect, useRef } from "react";

import { ButtonLink } from "#/components/button-link.tsx";

const disabledLink = "aria-disabled:pointer-events-none aria-disabled:opacity-50";

// The router matches the raw search: by default `{}`, the first page, would be active on every page. The current
// page is marked from the validated `page` instead, which also covers `?page=1`.
const exactly = { exact: true };

const searchOf = (page: number) => (page === 1 ? {} : { page });

/** The first page, the last, and those next to the current one; a gap between them is an ellipsis. */
export const pagesAround = (
  page: number,
  pages: number,
): ReadonlyArray<number | "gap-before" | "gap-after"> => {
  const shown = [...new Set([1, page - 1, page, page + 1, pages])]
    .filter((n) => n >= 1 && n <= pages)
    .toSorted((a, b) => a - b);
  return shown.flatMap((n, i) =>
    i > 0 && n - (shown[i - 1] ?? n) > 1
      ? [n <= page ? ("gap-before" as const) : ("gap-after" as const), n]
      : [n],
  );
};

// The page links are `ButtonLink`s, not the `PaginationLink` of `@quack/ui`: it renders its `<a>` through
// `Button`, which gives it the role of a button.
export function UsersPagination({ page, pages }: { page: number; pages: number }) {
  const currentLink = useRef<HTMLAnchorElement>(null);
  // Previous or Next, disabled on the first or the last page, can no longer hold the focus it had.
  const refocusOn = useRef<number | null>(null);
  useEffect(() => {
    if (refocusOn.current !== page) return;
    refocusOn.current = null;
    currentLink.current?.focus();
  }, [page]);

  const previous = Math.min(page - 1, pages);
  const next = page + 1;

  return (
    <Pagination aria-label="Pages of users" className="mx-0 w-auto">
      <PaginationContent>
        <PaginationItem>
          <ButtonLink
            to="/users"
            search={searchOf(previous)}
            disabled={previous < 1}
            activeOptions={exactly}
            onClick={() => {
              if (previous === 1) refocusOn.current = previous;
            }}
            variant="ghost"
            aria-label="Go to previous page"
            className={`pl-1.5 ${disabledLink}`}
          >
            <ChevronLeftIcon data-icon="inline-start" />
            <span className="hidden sm:block">Previous</span>
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
                ref={n === page ? currentLink : undefined}
                to="/users"
                search={searchOf(n)}
                activeOptions={exactly}
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
            to="/users"
            search={searchOf(next)}
            disabled={page >= pages}
            activeOptions={exactly}
            onClick={() => {
              if (next === pages) refocusOn.current = next;
            }}
            variant="ghost"
            aria-label="Go to next page"
            className={`pr-1.5 ${disabledLink}`}
          >
            <span className="hidden sm:block">Next</span>
            <ChevronRightIcon data-icon="inline-end" />
          </ButtonLink>
        </PaginationItem>
      </PaginationContent>
    </Pagination>
  );
}

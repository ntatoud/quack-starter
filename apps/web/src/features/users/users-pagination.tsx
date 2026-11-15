import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
} from "@quack/ui/components/pagination";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";

import { ButtonLink } from "#/components/button-link.tsx";

// Not the `PaginationLink` of `@quack/ui`: it renders its `<a>` through `Button`, which gives it the role of a button.
const disabledLink = "aria-disabled:pointer-events-none aria-disabled:opacity-50";

// Without it, a link whose search is part of the current one is active: `{}`, the first page, on every page.
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

export function UsersPagination({ page, pages }: { page: number; pages: number }) {
  return (
    <Pagination aria-label="Pages of users" className="mx-0 w-auto">
      <PaginationContent>
        <PaginationItem>
          <ButtonLink
            to="/users"
            search={searchOf(page - 1)}
            disabled={page <= 1}
            activeOptions={exactly}
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
                to="/users"
                search={searchOf(n)}
                activeOptions={exactly}
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
            search={searchOf(page + 1)}
            disabled={page >= pages}
            activeOptions={exactly}
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

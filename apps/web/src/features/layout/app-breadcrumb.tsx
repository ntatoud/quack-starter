import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbSeparator,
} from "@quack/ui/components/breadcrumb";
import { cn } from "@quack/ui/lib/utils";
import { Link, type LinkProps } from "@tanstack/react-router";
import { Fragment } from "react";

export type Crumb = { readonly label: string; readonly to?: LinkProps["to"] };

// A long title, such as an email, is cut rather than wrapped: the top bar is one line high.
const titleClassName = "min-w-0 truncate text-sm font-medium";

/** The title of the page, its `h1`, after the `trail` of pages that lead to it. */
export function AppBreadcrumb({
  title,
  trail,
}: {
  title: string;
  trail?: ReadonlyArray<Crumb> | undefined;
}) {
  if (trail === undefined || trail.length === 0) return <h1 className={titleClassName}>{title}</h1>;

  return (
    <Breadcrumb className="min-w-0">
      <BreadcrumbList className="flex-nowrap">
        {trail.map((crumb) => (
          <Fragment key={crumb.label}>
            <BreadcrumbItem className="shrink-0">
              {crumb.to === undefined ? (
                crumb.label
              ) : (
                <BreadcrumbLink render={<Link to={crumb.to} />}>{crumb.label}</BreadcrumbLink>
              )}
            </BreadcrumbItem>
            <BreadcrumbSeparator className="shrink-0">/</BreadcrumbSeparator>
          </Fragment>
        ))}
        <BreadcrumbItem className="min-w-0">
          {/* Not shadcn's BreadcrumbPage: its role of a disabled link would be read inside the heading. */}
          <h1 aria-current="page" className={cn(titleClassName, "text-foreground")}>
            {title}
          </h1>
        </BreadcrumbItem>
      </BreadcrumbList>
    </Breadcrumb>
  );
}

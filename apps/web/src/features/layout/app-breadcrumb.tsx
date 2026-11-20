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

const titleClassName = "text-sm font-medium";

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
    <Breadcrumb>
      <BreadcrumbList>
        {trail.map((crumb) => (
          <Fragment key={crumb.label}>
            <BreadcrumbItem>
              {crumb.to === undefined ? (
                crumb.label
              ) : (
                <BreadcrumbLink render={<Link to={crumb.to} />}>{crumb.label}</BreadcrumbLink>
              )}
            </BreadcrumbItem>
            <BreadcrumbSeparator>/</BreadcrumbSeparator>
          </Fragment>
        ))}
        <BreadcrumbItem>
          {/* Not shadcn's BreadcrumbPage: its role of a disabled link would be read inside the heading. */}
          <h1 aria-current="page" className={cn(titleClassName, "text-foreground")}>
            {title}
          </h1>
        </BreadcrumbItem>
      </BreadcrumbList>
    </Breadcrumb>
  );
}

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@quack/ui/components/breadcrumb";
import { Link, type LinkProps } from "@tanstack/react-router";
import { Fragment } from "react";

export type Crumb = { readonly label: string; readonly to?: LinkProps["to"] };

/** The way to the page, the page last: its title, the `h1` of the page. */
export type Crumbs = readonly [...ReadonlyArray<Crumb>, Crumb];

const titleClassName = "text-sm font-medium";

export function AppBreadcrumb({ crumbs }: { crumbs: Crumbs }) {
  const above = crumbs.slice(0, -1);
  const page = crumbs.at(-1);
  if (above.length === 0) return <h1 className={titleClassName}>{page?.label}</h1>;

  return (
    <Breadcrumb>
      <BreadcrumbList>
        {above.map((crumb) => (
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
          <h1>
            <BreadcrumbPage className={titleClassName}>{page?.label}</BreadcrumbPage>
          </h1>
        </BreadcrumbItem>
      </BreadcrumbList>
    </Breadcrumb>
  );
}

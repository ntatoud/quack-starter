import { type Button, buttonVariants } from "@quack/ui/components/button";
import { createLink } from "@tanstack/react-router";
import type { ComponentProps } from "react";

/**
 * A link of the router that looks like a `Button`: it takes the `to`, `search`, and `params` of a `Link`,
 * and the `variant` and `size` of a `Button`.
 * It stays an `<a>`, so assistive tech announces a link: `Button` itself gives its element the role of a button.
 */
export const ButtonLink = createLink(
  ({
    className,
    variant,
    size,
    ...props
  }: ComponentProps<"a"> & Pick<ComponentProps<typeof Button>, "variant" | "size">) => (
    <a data-slot="button" className={buttonVariants({ variant, size, className })} {...props} />
  ),
);

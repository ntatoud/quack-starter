import { brand } from "@quack/brand/brand";

export const pageTitle = (...segments: ReadonlyArray<string>) =>
  [
    ...segments.map((segment) => segment.trim()).filter((segment) => segment !== ""),
    brand.pageTitleSuffix,
  ].join(" | ");

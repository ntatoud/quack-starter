export type Size = "sm" | "md" | "lg";

export const textSize = { sm: "text-[0.8rem]", md: "text-sm", lg: "text-sm" } satisfies Record<
  Size,
  string
>;

/** The heights of the Input sizes, so every control of a form lines up. */
export const controlHeight = { sm: "h-7", md: "h-8", lg: "h-9" } satisfies Record<Size, string>;

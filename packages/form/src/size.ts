export type Size = "sm" | "md" | "lg";

export const textSize = { sm: "text-[0.8rem]", md: "text-sm", lg: "text-sm" } satisfies Record<
  Size,
  string
>;

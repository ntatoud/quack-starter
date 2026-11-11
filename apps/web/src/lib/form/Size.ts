/** The sizes every field and form component takes. An input and a button of one size line up. */
export type Size = "sm" | "md" | "lg";

/** The text of a label or an error next to a control of that size. */
export const textSize = { sm: "text-[0.8rem]", md: "text-sm", lg: "text-sm" } satisfies Record<
  Size,
  string
>;

import { page } from "vite-plus/test/browser";

/** `node` as a `type`, or a failed test when it is missing or of another type. */
export const elementOf = <T extends Element>(
  type: abstract new (...args: never) => T,
  node: Element | null | undefined,
): T => {
  if (!(node instanceof type)) throw new Error(`Expected a ${type.name}, found ${String(node)}.`);

  return node;
};

/** The box a menu's checkbox item draws before its label. */
export const checkboxBox = (item: Element) =>
  elementOf(HTMLElement, item.querySelector("span[aria-hidden]"));

/** The element of `data-slot` `name`, the first of the page. */
export const slot = (name: string) =>
  elementOf(HTMLElement, document.querySelector(`[data-slot=${name}]`));

/** The button in the header of the column titled `name`: it sorts the column, or opens its filter. */
export const headerButton = (name: string) =>
  page.getByRole("columnheader", { name, exact: true }).getByRole("button");

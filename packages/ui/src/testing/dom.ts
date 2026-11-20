/** `node` as a `type`, or a failed test when it is missing or of another type. */
export const elementOf = <T extends Element>(
  type: abstract new (...args: never) => T,
  node: Element | null | undefined,
): T => {
  if (!(node instanceof type)) throw new Error(`Expected a ${type.name}, found ${String(node)}.`);
  return node;
};

/** The element of `data-slot` `name`, the first of the page. */
export const slot = (name: string) =>
  elementOf(HTMLElement, document.querySelector(`[data-slot=${name}]`));

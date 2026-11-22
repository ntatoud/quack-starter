import * as React from "react";

export const selectColumnId = "__select";

export type Pin = { readonly start: number; readonly edge: boolean };

/**
 * Where the columns held at the start and at the end sit. Each pinned column sits at the width of those before it,
 * measured on their headers; the shades of overflow sit at the widths held at each end, beside the held columns, not
 * under them at the edges of the table.
 */
export function usePinLayout({
  pinned,
  selectable,
  head,
  hasStickyEnd,
}: {
  /** The ids of the columns pinned, in order. */
  pinned: ReadonlyArray<string>;
  /** The checkbox column is held with them. */
  selectable: boolean;
  head: React.RefObject<HTMLTableSectionElement | null>;
  hasStickyEnd: boolean;
}) {
  // The columns held at the start: the checkbox column with the pinned ones, then the pinned ones in order.
  const pinChain = React.useMemo(
    () => (pinned.length === 0 ? [] : selectable ? [selectColumnId, ...pinned] : pinned),
    [pinned, selectable],
  );

  const pinHeads = React.useRef(new Map<string, HTMLTableCellElement>());
  const [pinOffsets, setPinOffsets] = React.useState<Readonly<Record<string, number>>>({});
  const [heldEdges, setHeldEdges] = React.useState({ start: 0, end: 0 });
  React.useLayoutEffect(() => {
    const endHead = () => head.current?.querySelector<HTMLElement>("th[data-sticky=end]");

    const measure = () => {
      let start = 0;
      const next: Record<string, number> = {};

      for (const id of pinChain) {
        next[id] = start;
        start += pinHeads.current.get(id)?.offsetWidth ?? 0;
      }

      setPinOffsets((current) =>
        JSON.stringify(current) === JSON.stringify(next) ? current : next,
      );
      const end = endHead()?.offsetWidth ?? 0;
      setHeldEdges((current) =>
        current.start === start && current.end === end ? current : { start, end },
      );
    };

    measure();
    const observer = new ResizeObserver(measure);

    for (const id of pinChain) {
      const cell = pinHeads.current.get(id);

      if (cell !== undefined) observer.observe(cell);
    }

    const end = endHead();

    if (end !== null && end !== undefined) observer.observe(end);

    return () => observer.disconnect();
    // oxlint-disable-next-line react/exhaustive-effect-dependencies -- the sticky end cell comes and goes with hasStickyEnd, and is a new node to measure.
  }, [pinChain, hasStickyEnd, head]);

  const pinOf = (id: string): Pin | undefined => {
    const at = pinChain.indexOf(id);

    return at === -1 ? undefined : { start: pinOffsets[id] ?? 0, edge: at === pinChain.length - 1 };
  };

  const pinHead = (id: string) => (cell: HTMLTableCellElement | null) => {
    if (cell === null) pinHeads.current.delete(id);
    else pinHeads.current.set(id, cell);
  };

  return { pins: { of: pinOf, head: pinHead }, heldEdges };
}

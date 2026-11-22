import type { Virtualizer } from "@tanstack/react-virtual";
import * as React from "react";

export type Viewport = React.RefObject<HTMLDivElement | null>;

/**
 * What held the focus (a row, a control of its own, the empty slot) goes: the focus lands on the scroll area rather
 * than the page.
 */
export const releaseFocusTo = (viewport: Viewport, node: HTMLElement | null) => {
  if (node !== null && node.contains(document.activeElement))
    viewport.current?.focus({ preventScroll: true });
};

/**
 * The row that takes the Tab stop and the moves of the arrow keys between rows. Other rows (a page, a sorting, a
 * search) start from the top: the scroll of the old ones means nothing to them, and a row keyed by its index would
 * carry the Tab stop over from the last page. More rows of the same list, loaded at its end, keep their place.
 */
export function useRowFocus({
  viewport,
  virtualizer,
  rowCount,
  rowsKey,
}: {
  viewport: Viewport;
  virtualizer: Virtualizer<HTMLDivElement, Element>;
  rowCount: number;
  rowsKey: string | undefined;
}) {
  const lastRowsKey = React.useRef(rowsKey);
  // A row asked for and not rendered yet: a new request, other rows, or the table gone, gives up on it.
  const focusFrame = React.useRef(0);
  React.useEffect(() => () => cancelAnimationFrame(focusFrame.current), []);
  const [activeRow, setActiveRow] = React.useState<string | null>(null);
  // Before paint: the new rows never show at the old scroll.
  React.useLayoutEffect(() => {
    if (lastRowsKey.current === rowsKey) return;
    lastRowsKey.current = rowsKey;
    cancelAnimationFrame(focusFrame.current);
    viewport.current?.scrollTo({ top: 0 });
    setActiveRow(null);
  }, [rowsKey, viewport]);

  const focusRow = (index: number) => {
    cancelAnimationFrame(focusFrame.current);
    const target = Math.min(Math.max(index, 0), rowCount - 1);
    const find = () => viewport.current?.querySelector<HTMLElement>(`[data-row-index="${target}"]`);
    const element = find();

    if (element !== null && element !== undefined) {
      element.focus();

      return;
    }

    // A row out of view in a virtual table is not rendered yet: it is once scrolled to, and measured, which may take
    // a few frames.
    virtualizer.scrollToIndex(target);
    let frames = 0;

    const retry = () => {
      const found = find();

      if (found !== null && found !== undefined) found.focus();
      else if (++frames < 10) focusFrame.current = requestAnimationFrame(retry);
    };

    focusFrame.current = requestAnimationFrame(retry);
  };

  // A row that goes (deleted, filtered out) with the focus, on it or on a control of its own (an action).
  const keepRowFocus = React.useCallback(
    (node: HTMLTableRowElement | null) => () => releaseFocusTo(viewport, node),
    [viewport],
  );

  // A focused row scrolled out of a virtual table leaves it too.
  const measureRow = React.useCallback(
    (node: HTMLTableRowElement | null) => {
      virtualizer.measureElement(node);

      return () => {
        releaseFocusTo(viewport, node);
        // Lets the virtualizer forget the rows gone from the page.
        virtualizer.measureElement(null);
      };
    },
    [virtualizer, viewport],
  );

  return { activeRow, setActiveRow, focusRow, keepRowFocus, measureRow };
}

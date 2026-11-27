import type * as React from "react";

export type RowKeyEvent = React.KeyboardEvent<HTMLTableRowElement>;

/** What the keys of a row need to know of the table it sits in. */
export type RowKeyboard = {
  readonly index: number;
  readonly rowCount: number;
  readonly viewport: React.RefObject<HTMLElement | null>;
  readonly headerHeight: number;
  readonly selecting: boolean;
  readonly focusRow: (index: number) => void;
  /** What Enter does: opens the row, or follows its link. */
  readonly open: (event: RowKeyEvent) => void;
};

// Alt and Ctrl with a key belong to the browser and the app; Cmd with an arrow goes to the end, as on macOS.
const belongsToBrowser = (event: RowKeyEvent) =>
  event.altKey || event.ctrlKey || (event.metaKey && !["ArrowUp", "ArrowDown"].includes(event.key));

// As many rows as show below the header, in the viewport and the window both (a table of unbounded height is as
// tall as its rows).
const pageOf = ({ viewport, headerHeight }: RowKeyboard, rowHeight: number) => {
  const box = viewport.current?.getBoundingClientRect();

  const shown =
    box === undefined
      ? 0
      : Math.min(box.bottom, window.innerHeight) - Math.max(box.top + headerHeight, 0);

  return Math.max(1, Math.floor(shown / Math.max(1, rowHeight)));
};

const moveOf = (event: RowKeyEvent, keyboard: RowKeyboard) => {
  const { index, rowCount } = keyboard;
  const page = pageOf(keyboard, event.currentTarget.offsetHeight);

  return {
    ArrowDown: event.metaKey ? rowCount - 1 : index + 1,
    ArrowUp: event.metaKey ? 0 : index - 1,
    PageDown: index + page,
    PageUp: index - page,
    Home: 0,
    End: rowCount - 1,
  }[event.key];
};

/** The arrow keys, Page Up and Down, Home and End move between rows; Enter opens one. */
export const onRowKeyDown = (event: RowKeyEvent, keyboard: RowKeyboard) => {
  if (event.target !== event.currentTarget || belongsToBrowser(event)) return;
  const move = moveOf(event, keyboard);

  if (move !== undefined && !event.shiftKey) {
    event.preventDefault();
    keyboard.focusRow(move);
  } else if (event.key === " ") {
    // The browser would scroll a page and leave the focused row behind. With a selection, the row part of it handles
    // Space (and skips the primitive's handler once this one prevents the default).
    if (!keyboard.selecting) event.preventDefault();
  } else if (event.key === "Enter" && !event.repeat) keyboard.open(event);
};

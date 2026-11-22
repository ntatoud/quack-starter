import * as React from "react";

import { releaseFocusTo } from "@quack/ui/lib/data-table/use-row-focus";

// The message of an empty slot, as its state marks it, or its text but that of its controls (a "Clear filters" button
// is no part of "No results").
const messageOf = (slot: HTMLElement) => {
  const marked = slot.querySelectorAll("[data-slot=data-table-state-message]");

  if (marked.length > 0)
    return [...marked].map((node) => (node.textContent ?? "").trim()).join(" ");
  const parts: Array<string> = [];
  const walker = document.createTreeWalker(slot, NodeFilter.SHOW_TEXT);

  for (let node = walker.nextNode(); node !== null; node = walker.nextNode())
    if (node.parentElement?.closest("button, a, [role=button]") === null)
      parts.push((node.textContent ?? "").trim());

  return parts.filter((part) => part !== "").join(" ");
};

/**
 * The slot the body shows with no row, and what it says. Without pagination to say it, rows that go to none, or load,
 * say so: the message is what the slot shows (its alert, an error, speaks for itself).
 */
export function useEmptySlot({
  viewport,
  rowCount,
  empty,
}: {
  viewport: React.RefObject<HTMLDivElement | null>;
  rowCount: number;
  empty: React.ReactNode;
}) {
  const slotRef = React.useRef<HTMLDivElement>(null);
  const lastText = React.useRef("");
  const [message, setMessage] = React.useState("");
  React.useLayoutEffect(() => {
    const read = () => {
      const slot = slotRef.current;

      const text =
        rowCount > 0 || slot === null || slot.querySelector("[role=alert]") ? "" : messageOf(slot);

      if (text === lastText.current) return;
      lastText.current = text;
      // Rows back, the message goes: it would be stale, and the same one later would be no change to announce.
      setMessage(text);
    };

    read();
    // The slot's content may change on its own (a new language, a state of the app's): it is read again then.
    const slot = slotRef.current;

    if (slot === null || rowCount > 0) return;
    const observer = new MutationObserver(read);
    observer.observe(slot, { childList: true, characterData: true, subtree: true });

    return () => observer.disconnect();
    // oxlint-disable-next-line react/exhaustive-effect-dependencies -- a new empty slot is a new node to read and observe.
  }, [rowCount, empty]);

  // The slot goes once rows come (a retry that worked): the focus it held (its button) goes to the scroll area.
  const keepFocusInTable = React.useCallback(
    (node: HTMLDivElement | null) => {
      slotRef.current = node;

      return () => {
        slotRef.current = null;
        releaseFocusTo(viewport, node);
      };
    },
    [viewport],
  );

  return { keepFocusInTable, message };
}

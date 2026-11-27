import { definePrimitive } from "@ui-sdk/core";

export type SelectionBarOptions = {
  /** How many rows are selected. */
  count?: number;
  /** Clears the selection: what an agent's `clear` calls. */
  onClear?: () => void;
  /** Where the focus goes from the bar once nothing is selected and it hides. */
  focusOnEmpty?: () => HTMLElement | null | undefined;
};

/**
 * The bar of a table's selection. It hides with nothing selected; the count reaches screen readers from the first row
 * ticked (its `status` is in the page before it shows, as a region read only when its text changes), and the focus it
 * held once the selection clears (its clear button, a bulk action) goes to `focusOnEmpty`, by default the "select all"
 * box of the table that follows it.
 */
export const selectionBar = definePrimitive({
  // Its slots are the bar and the status: `data-table-selection-bar`, and no element of its own for the root.
  name: "data-table-selection",
  options: { count: "number", onClear: "callback", focusOnEmpty: "value" },
  state: (options: SelectionBarOptions) => ({ count: options.count ?? 0 }),
  sync: (options: SelectionBarOptions) => ({ count: options.count ?? 0 }),
  api: (context) => ({
    clear: () => context.options().onClear?.(),
    /** Moves the focus the bar held to where `focusOnEmpty` says. */
    handOffFocus: (bar: HTMLElement) => {
      const active = document.activeElement;

      // The focus moved on by itself (a dialog the action opened): it stays there.
      if (active !== null && active !== document.body && !bar.contains(active)) return;
      // By default, the "select all" box of the nearest table around the bar.
      let around = bar.parentElement;

      while (around !== null && around.querySelector("[data-slot=data-table]") === null)
        around = around.parentElement;

      const target =
        context.options().focusOnEmpty?.() ??
        around?.querySelector<HTMLElement>("[data-slot=data-table] thead [role=checkbox]");

      target?.focus();
    },
  }),
  slots: (slot) => ({
    status: slot({
      role: "status",
    }),
    bar: slot({
      role: "region",
      attrs: (state) => ({
        "aria-label": `${state.count} selected`,
        hidden: state.count === 0 ? "" : undefined,
      }),
      bind: (el, part) => {
        let hadFocus = false;

        const focused = () => {
          hadFocus = true;
        };

        const left = () => {
          // Hidden with the focus inside, the bar loses it to nothing: that blur is the one to act on. Any other (a
          // click on the page) lets the focus go for good.
          if (!el.hidden) hadFocus = false;
        };

        // Once the bar hides, after the page shows that: the focus is gone or about to.
        const hiding = new MutationObserver(() => {
          if (!el.hidden || !hadFocus) return;
          hadFocus = false;
          part.api.handOffFocus(el);
        });

        el.addEventListener("focusin", focused);
        el.addEventListener("focusout", left);
        hiding.observe(el, { attributes: true, attributeFilter: ["hidden"] });

        return () => {
          el.removeEventListener("focusin", focused);
          el.removeEventListener("focusout", left);
          hiding.disconnect();
        };
      },
    }),
  }),
  agent: { actions: ["clear"], shown: (state) => state.count > 0 },
});

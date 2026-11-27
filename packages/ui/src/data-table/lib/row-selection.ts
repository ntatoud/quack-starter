import { createChange, createSelection, definePrimitive, type ChangeDetails } from "@ui-sdk/core";

/** A row a table shows, for the selection: `selectable` is false for a row that cannot be ticked. */
export type RowSelectionRow = {
  readonly value: string;
  readonly label?: string | undefined;
  readonly selectable: boolean;
};

export type RowSelectionReason = "item-press" | "select-all" | "clear";

export type RowSelectionOptions = {
  /** The ids selected, in the order they were selected. */
  selected?: ReadonlyArray<string>;
  defaultSelected?: ReadonlyArray<string>;
  onSelectedChange?: (
    selected: ReadonlyArray<string>,
    details: ChangeDetails<RowSelectionReason>,
  ) => void;
  /** The rows of the table, in order: the ones to select a range between, and select all. */
  rows?: ReadonlyArray<RowSelectionRow>;
};

type PressOptions = { readonly range?: boolean; readonly event?: Event };

/**
 * The selection of the rows of a table: Space on a focused row, Shift + Space or Shift + click for the rows from the
 * last one ticked, select all for the rows shown, and the rows that cannot be ticked skipped by each. The ids selected
 * stay the table's own (`selected` and `onSelectedChange`): they last across pages, a sort or a filter, and the rows
 * in `rows` are those of the page.
 */
export const rowSelection = definePrimitive({
  name: "data-table",
  options: {
    selected: "value",
    defaultSelected: "value",
    onSelectedChange: "callback",
    rows: "value",
  },
  controlled: ["selected"],
  state: (options: RowSelectionOptions) => ({
    selected: [...(options.selected ?? options.defaultSelected ?? [])],
  }),
  sync: (options: RowSelectionOptions) =>
    options.selected === undefined ? {} : { selected: [...options.selected] },
  api: (context) => {
    const change = createChange(context);
    const rows = () => context.options().rows ?? [];
    const selectableIds = () => rows().flatMap((row) => (row.selectable ? [row.value] : []));

    const selection = createSelection(context, {
      key: "selected",
      set: (value, details) => change("selected", value, details),
      order: selectableIds,
      multiple: () => true,
      selectable: (id) => selectableIds().includes(id),
    });

    // Shift is held when the box is pressed, not when it changes: the change event of a checkbox does not tell.
    let shiftOnPress = false;

    const press = (id: string, { range = false, event }: PressOptions = {}) => {
      if (!selectableIds().includes(id)) return;
      const details = { reason: "item-press", ...(event && { event }) } as const;
      const anchor = selection.anchor();

      if (range && anchor !== null && selectableIds().includes(anchor)) {
        if (selection.isSelected(id)) {
          // The range is cleared, as it is ticked: from the last row pressed to this one.
          const order = selectableIds();

          const [from = 0, to = 0] = [order.indexOf(anchor), order.indexOf(id)].toSorted(
            (a, b) => a - b,
          );

          const cleared = new Set(order.slice(from, to + 1));
          change(
            "selected",
            context.store.get().selected.filter((selected) => !cleared.has(selected)),
            details,
          );
          selection.setAnchor(id);
        } else {
          selection.extend(id, details);
          selection.setAnchor(id);
        }

        return;
      }

      selection.toggle(id, details);
    };

    return {
      isSelected: selection.isSelected,
      press,
      /** Ticks or unticks a row. */
      toggle: (id: string) => press(id),
      /** Selects every row of the table that can be, or clears them once they all are: other pages stay as they are. */
      toggleAll: (event?: Event) => {
        const ids = selectableIds();
        const current = context.store.get().selected;
        const all = ids.length > 0 && ids.every((id) => current.includes(id));
        const shown = new Set(ids);
        change(
          "selected",
          all ? current.filter((id) => !shown.has(id)) : [...new Set([...current, ...ids])],
          {
            reason: "select-all",
            ...(event && { event }),
          },
        );
      },
      /** Selects the rows of the table that can be. */
      selectAll: () => {
        const current = context.store.get().selected;
        change("selected", [...new Set([...current, ...selectableIds()])], {
          reason: "select-all",
        });
      },
      /** Clears the selection, the rows of other pages with it. */
      clear: () => {
        change("selected", [], { reason: "clear" });
      },
      /** What an agent picks a row from: the rows that can be selected, named as their checkbox. */
      items: () =>
        rows().flatMap((row) =>
          row.selectable ? [{ value: row.value, label: row.label ?? row.value }] : [],
        ),
      /** Whether Shift was held when the box was last pressed, once. */
      rememberShift: (held: boolean) => {
        shiftOnPress = held;
      },
      takeShift: () => {
        const held = shiftOnPress;
        shiftOnPress = false;

        return held;
      },
    };
  },
  slots: (slot) => ({
    root: slot({
      attrs: () => ({ role: "group" }),
    }),
    row: slot<{ value: string }>({
      props: { value: "string" },
      attrs: (state, part) => ({
        "data-state": state.selected.includes(part.key) ? "selected" : undefined,
      }),
      on: {
        keydown: (event, { el, key, api }) => {
          const press = event as KeyboardEvent;

          if (press.target !== el || press.key !== " ") return;

          // Alt, Ctrl and Cmd with Space belong to the browser and the app.
          if (press.altKey || press.ctrlKey || press.metaKey) return;
          // The browser would scroll a page and leave the focused row behind.
          press.preventDefault();

          if (!press.repeat) api.press(key, { range: press.shiftKey, event: press });
        },
      },
    }),
    box: slot({
      attrs: () => ({}),
      on: {
        pointerdown: (event, { api }) => api.rememberShift((event as PointerEvent).shiftKey),
        keydown: (event, { api }) => {
          const press = event as KeyboardEvent;

          if (press.key === " ") api.rememberShift(press.shiftKey);
        },
      },
    }),
  }),
  agent: { actions: ["toggle", "selectAll", "clear"], items: (api) => api.items() },
});

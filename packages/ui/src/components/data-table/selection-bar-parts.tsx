"use client";

import { createParts } from "@ui-sdk/react/primitive";

import { selectionBar } from "@quack/ui/lib/data-table/selection-bar";

export const {
  Root: SelectionBarRoot,
  Status: SelectionBarStatus,
  Bar: SelectionBarBar,
} = createParts(selectionBar, { status: "span", bar: "div" });

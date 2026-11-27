"use client";

import { createParts } from "@ui-sdk/react/primitive";

import { selectionBar } from "#/data-table/lib/selection-bar.ts";

export const {
  Root: SelectionBarRoot,
  Status: SelectionBarStatus,
  Bar: SelectionBarBar,
} = createParts(selectionBar, { status: "span", bar: "div" });

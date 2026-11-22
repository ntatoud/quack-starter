import * as React from "react";
import { describe, expect, it } from "vite-plus/test";
import { page } from "vite-plus/test/browser";

import { booleanFilter } from "@quack/ui/components/data-table/filters/boolean-filter";

import { render } from "vitest-browser-react";
import { isFunction } from "@quack/ui/lib/guards";

const filter = booleanFilter({ title: "Onboarded" });

function Editor({ initial }: { initial?: boolean }) {
  const [value, setValue] = React.useState<boolean | undefined>(initial);
  const [open, setOpen] = React.useState(false);

  return (
    <>
      {filter.editor({
        trigger: { "data-slot": "data-table-filter-trigger", className: "", children: "Onboarded" },
        title: filter.title,
        value,
        onValueChange: (next) => setValue(isFunction(next) ? next(value) : next),
        open,
        onOpenChange: setOpen,
      })}
      <output>{value === undefined ? "none" : filter.summary(value)}</output>
    </>
  );
}

describe("booleanFilter", () => {
  it("holds false, not an empty value, once No is chosen", async () => {
    await render(<Editor />);

    await page.getByRole("button", { name: "Onboarded" }).click();
    await page.getByRole("menuitemradio", { name: "No" }).click();

    await expect.element(page.getByRole("status")).toHaveTextContent("No");
  });

  it("marks the value held, and clears it", async () => {
    await render(<Editor initial={true} />);

    await page.getByRole("button", { name: "Onboarded" }).click();
    await expect
      .element(page.getByRole("menuitemradio", { name: "Yes" }))
      .toHaveAttribute("aria-checked", "true");
    await page.getByRole("menuitem", { name: "Clear" }).click();

    await expect.element(page.getByRole("status")).toHaveTextContent("none");
  });
});

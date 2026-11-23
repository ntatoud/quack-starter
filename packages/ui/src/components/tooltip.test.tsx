import { describe, expect, it } from "vite-plus/test";
import { page, userEvent } from "vite-plus/test/browser";
import { render } from "vitest-browser-react";

import { Button } from "@quack/ui/components/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@quack/ui/components/tooltip";
import { SettingsIcon } from "lucide-react";

describe("Tooltip", () => {
  it("names an icon-only trigger, and shows on keyboard focus", async () => {
    await render(
      <Tooltip>
        <TooltipTrigger render={<Button size="icon" />}>
          <SettingsIcon aria-hidden="true" />
        </TooltipTrigger>
        <TooltipContent>Settings</TooltipContent>
      </Tooltip>,
    );
    const trigger = page.getByRole("button", { name: "Settings" });
    await expect.element(trigger).toBeInTheDocument();

    await userEvent.keyboard("{Tab}");

    await expect.element(trigger).toHaveFocus();
    await expect.element(page.getByRole("tooltip")).toBeVisible();

    await userEvent.keyboard("{Escape}");
    await expect.element(page.getByRole("tooltip", { includeHidden: true })).not.toBeVisible();
    await expect.element(trigger).toHaveFocus();
  });

  it("describes a trigger that has a name", async () => {
    await render(
      <Tooltip>
        <TooltipTrigger render={<Button />}>Save</TooltipTrigger>
        <TooltipContent>Saves a draft</TooltipContent>
      </Tooltip>,
    );

    await expect
      .element(page.getByRole("button", { name: "Save" }))
      .toHaveAccessibleDescription("Saves a draft");
  });
});

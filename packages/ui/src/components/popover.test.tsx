import { checkPattern } from "@ui-sdk/core/testing";
import { describe, expect, it } from "vite-plus/test";
import { page, userEvent } from "vite-plus/test/browser";
import { render } from "vitest-browser-react";

import { Button } from "@quack/ui/components/button";
import {
  Popover,
  PopoverClose,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@quack/ui/components/popover";

const trigger = () => page.getByRole("button", { name: "Share" });
const popover = () => page.getByRole("dialog", { name: "Share the board" });

const open = async () => {
  // A control after the popover: Tab from its last one moves on to the page, which checkPattern follows.
  await render(
    <>
      <Popover>
        <PopoverTrigger render={<Button />}>Share</PopoverTrigger>
        <PopoverContent>
          <PopoverHeader>
            <PopoverTitle>Share the board</PopoverTitle>
            <PopoverDescription>Anyone with the link can see it.</PopoverDescription>
          </PopoverHeader>
          <PopoverClose render={<Button />}>Done</PopoverClose>
        </PopoverContent>
      </Popover>
      <Button>Next</Button>
    </>,
  );
  await trigger().click();
  await expect.element(popover()).toBeVisible();
};

describe("Popover", () => {
  it("is a dialog named and described by its title and description", async () => {
    await open();

    await expect.element(popover()).toHaveAccessibleDescription("Anyone with the link can see it.");
    await checkPattern(popover().element(), "dialog");
  });

  it("closes on Escape and gives the focus back to its trigger", async () => {
    await open();

    await userEvent.keyboard("{Escape}");

    await expect.element(popover()).not.toBeInTheDocument();
    await expect.element(trigger()).toHaveFocus();
  });

  it("closes on its Close part and gives the focus back to its trigger", async () => {
    await open();

    await page.getByRole("button", { name: "Done" }).click();

    await expect.element(popover()).not.toBeInTheDocument();
    await expect.element(trigger()).toHaveFocus();
  });
});

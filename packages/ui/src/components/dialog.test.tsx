import { checkPattern } from "@ui-sdk/core/testing";
import { describe, expect, it } from "vite-plus/test";
import { page, userEvent } from "vite-plus/test/browser";
import { render } from "vitest-browser-react";

import { Button } from "@quack/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@quack/ui/components/dialog";

const trigger = () => page.getByRole("button", { name: "Edit profile" });
const dialog = () => page.getByRole("dialog", { name: "Profile" });

const open = async ({ showCloseButton = true, footerClose = false } = {}) => {
  await render(
    <Dialog>
      <DialogTrigger render={<Button />}>Edit profile</DialogTrigger>
      <DialogContent showCloseButton={showCloseButton}>
        <DialogHeader>
          <DialogTitle>Profile</DialogTitle>
          <DialogDescription>Change your name.</DialogDescription>
        </DialogHeader>
        <input aria-label="Name" />
        <DialogFooter showCloseButton={footerClose} />
      </DialogContent>
    </Dialog>,
  );
  await trigger().click();
  await expect.element(dialog()).toBeVisible();
};

describe("Dialog", () => {
  it("follows the dialog pattern, named and described by its title and description", async () => {
    await open();

    await checkPattern(dialog().element(), "dialog");
    await expect.element(dialog()).toHaveAccessibleDescription("Change your name.");
  });

  it("closes on its Close button and gives the focus back to its trigger", async () => {
    await open();

    await page.getByRole("button", { name: "Close" }).click();

    await expect.element(dialog()).not.toBeInTheDocument();
    await expect.element(trigger()).toHaveFocus();
  });

  it("closes on Escape and gives the focus back to its trigger", async () => {
    await open();

    await userEvent.keyboard("{Escape}");

    await expect.element(dialog()).not.toBeInTheDocument();
    await expect.element(trigger()).toHaveFocus();
  });

  it("has no Close button when asked, and one in its footer when asked", async () => {
    await open({ showCloseButton: false, footerClose: true });

    const close = page.getByRole("button", { name: "Close" });
    await expect.element(close).toHaveTextContent("Close");
    expect(close.elements()).toHaveLength(1);

    await close.click();
    await expect.element(dialog()).not.toBeInTheDocument();
  });
});

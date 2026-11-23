import { checkPattern } from "@ui-sdk/core/testing";
import { useState } from "react";
import { describe, expect, it, vi } from "vite-plus/test";
import { page, userEvent } from "vite-plus/test/browser";
import { render } from "vitest-browser-react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@quack/ui/components/alert-dialog";
import { Button } from "@quack/ui/components/button";

function DeleteUser(props: { onDelete: () => void }) {
  const [open, setOpen] = useState(false);

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger render={<Button />}>Delete user</AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Ada?</AlertDialogTitle>
          <AlertDialogDescription>She loses access at once.</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={props.onDelete}>
            Delete
          </AlertDialogAction>
          <AlertDialogAction onClick={() => setOpen(false)}>Done</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

const trigger = () => page.getByRole("button", { name: "Delete user" });
const dialog = () => page.getByRole("alertdialog", { name: "Delete Ada?" });

const open = async () => {
  const onDelete = vi.fn();
  await render(<DeleteUser onDelete={onDelete} />);
  await trigger().click();
  await expect.element(dialog()).toBeVisible();

  return onDelete;
};

describe("AlertDialog", () => {
  it("follows the alert dialog pattern, described by its description", async () => {
    await open();

    await checkPattern(dialog().element(), "alertdialog");
    await expect.element(dialog()).toHaveAccessibleDescription("She loses access at once.");
  });

  it("closes on Cancel, without acting, and gives the focus back to its trigger", async () => {
    const onDelete = await open();

    await page.getByRole("button", { name: "Cancel" }).click();

    await expect.element(dialog()).not.toBeInTheDocument();
    await expect.element(trigger()).toHaveFocus();
    expect(onDelete).not.toHaveBeenCalled();
  });

  it("stays open on its action, which the caller closes", async () => {
    const onDelete = await open();

    await page.getByRole("button", { name: "Delete", exact: true }).click();
    expect(onDelete).toHaveBeenCalledOnce();
    await expect.element(dialog()).toBeVisible();

    await page.getByRole("button", { name: "Done" }).click();
    await expect.element(dialog()).not.toBeInTheDocument();
    await expect.element(trigger()).toHaveFocus();
  });

  it("closes on Escape", async () => {
    await open();

    await userEvent.keyboard("{Escape}");

    await expect.element(dialog()).not.toBeInTheDocument();
  });
});

import { checkPattern } from "@ui-sdk/core/testing";
import { describe, expect, it, vi } from "vite-plus/test";
import { page, userEvent } from "vite-plus/test/browser";
import { render } from "vitest-browser-react";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@quack/ui/components/select";
import { elementOf } from "@quack/ui/testing/dom";

const roles = [
  { value: "admin", label: "Admin" },
  { value: "member", label: "Member" },
  { value: "guest", label: "Guest" },
];

const setup = (onValueChange = vi.fn()) =>
  render(
    <Select items={roles} placeholder="Pick a role" onValueChange={onValueChange}>
      <SelectTrigger aria-label="Role">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {roles.map((role) => (
          <SelectItem key={role.value} value={role.value}>
            {role.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>,
  );

const trigger = () => page.getByRole("combobox", { name: "Role" });

describe("Select", () => {
  // ui-sdk moves the focus into the list it opens, where the APG select-only combobox keeps it on the trigger.
  it.fails("follows the combobox pattern", async () => {
    const screen = await setup();

    await checkPattern(screen.container, "combobox");
  });

  it("opens a list that follows the listbox pattern", async () => {
    await setup();
    await trigger().click();
    const listbox = page.getByRole("listbox");
    await expect.element(listbox).toBeVisible();

    await checkPattern(listbox.element(), "listbox");
  });

  it("shows its placeholder, then the label of the option chosen with the keyboard", async () => {
    const onValueChange = vi.fn();
    await setup(onValueChange);
    await expect.element(trigger()).toHaveTextContent("Pick a role");

    await userEvent.keyboard("{Tab}{ArrowDown}");
    await expect.element(page.getByRole("listbox")).toBeVisible();
    await userEvent.keyboard("{ArrowDown}{Enter}");

    expect(onValueChange).toHaveBeenCalledExactlyOnceWith("member", expect.anything());
    await expect.element(page.getByRole("listbox")).not.toBeInTheDocument();
    await expect.element(trigger()).toHaveTextContent("Member");
    await expect.element(trigger()).toHaveFocus();
  });

  it("marks the chosen option, and names options without their check", async () => {
    await setup();
    await trigger().click();
    await page.getByRole("option", { name: "Guest" }).click();

    await trigger().click();

    const guest = page.getByRole("option", { name: "Guest", exact: true });
    await expect.element(guest).toHaveAttribute("aria-selected", "true");
    await expect.element(elementOf(SVGElement, guest.element().querySelector("svg"))).toBeVisible();
    await expect
      .element(page.getByRole("option", { name: "Admin" }))
      .toHaveAttribute("aria-selected", "false");
  });
});

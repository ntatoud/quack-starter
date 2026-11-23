import { checkPattern } from "@ui-sdk/core/testing";
import { describe, expect, it, vi } from "vite-plus/test";
import { page, userEvent } from "vite-plus/test/browser";
import { render } from "vitest-browser-react";

import { Button } from "@quack/ui/components/button";
import {
  Menu,
  MenuCheckboxItem,
  MenuContent,
  MenuItem,
  MenuRadioGroup,
  MenuRadioItem,
  MenuSeparator,
  MenuShortcut,
  MenuSub,
  MenuSubContent,
  MenuSubTrigger,
  MenuTrigger,
} from "@quack/ui/components/menu";

const setup = (onRename = vi.fn()) =>
  render(
    <Menu>
      <MenuTrigger render={<Button />}>Actions</MenuTrigger>
      <MenuContent>
        <MenuItem onSelect={onRename}>
          Rename
          <MenuShortcut>F2</MenuShortcut>
        </MenuItem>
        <MenuCheckboxItem value="pinned" defaultChecked>
          Pinned
        </MenuCheckboxItem>
        <MenuCheckboxItem value="starred" indicator="checkbox">
          Starred
        </MenuCheckboxItem>
        <MenuSeparator />
        <MenuRadioGroup defaultValue="asc">
          <MenuRadioItem value="asc">Ascending</MenuRadioItem>
          <MenuRadioItem value="desc">Descending</MenuRadioItem>
        </MenuRadioGroup>
        <MenuSub>
          <MenuSubTrigger>Move to</MenuSubTrigger>
          <MenuSubContent>
            <MenuItem value="archive">Archive</MenuItem>
          </MenuSubContent>
        </MenuSub>
      </MenuContent>
    </Menu>,
  );

const trigger = () => page.getByRole("button", { name: "Actions" });
const menu = () => page.getByRole("menu", { name: "Actions" });

describe("Menu", () => {
  it("follows the menu pattern", async () => {
    await setup();
    await trigger().click();
    await expect.element(menu()).toBeVisible();

    await checkPattern(menu().element(), "menu");
  });

  it("opens on Enter onto its first item, runs an item, and gives the focus back", async () => {
    const onRename = vi.fn();
    await setup(onRename);

    await userEvent.keyboard("{Tab}{Enter}");
    await expect.element(page.getByRole("menuitem", { name: "Rename" })).toHaveFocus();

    await userEvent.keyboard("{Enter}");
    expect(onRename).toHaveBeenCalledOnce();
    await expect.element(menu()).not.toBeInTheDocument();
    await expect.element(trigger()).toHaveFocus();
  });

  it("names its items without their decorations, and checks a checkbox item", async () => {
    await setup();
    await trigger().click();

    const pinned = page.getByRole("menuitemcheckbox", { name: "Pinned" });
    const starred = page.getByRole("menuitemcheckbox", { name: "Starred" });
    await expect.element(pinned).toBeChecked();
    await expect.element(starred).not.toBeChecked();
    await expect.element(page.getByRole("menuitemradio", { name: "Ascending" })).toBeChecked();
    await expect
      .element(page.getByRole("menuitem", { name: "Move to" }))
      .toHaveAttribute("aria-haspopup", "menu");

    await starred.click();
    await trigger().click();
    await expect.element(starred).toBeChecked();
  });

  it("opens its submenu with ArrowRight and closes it with ArrowLeft", async () => {
    await setup();
    await trigger().click();
    const sub = page.getByRole("menuitem", { name: "Move to" });

    sub.element().focus();
    await userEvent.keyboard("{ArrowRight}");
    await expect.element(page.getByRole("menuitem", { name: "Archive" })).toHaveFocus();

    await userEvent.keyboard("{ArrowLeft}");
    await expect.element(page.getByRole("menuitem", { name: "Archive" })).not.toBeInTheDocument();
    await expect.element(sub).toHaveFocus();
  });
});

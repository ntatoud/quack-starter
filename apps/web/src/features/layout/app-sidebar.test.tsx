import { describe, expect, it } from "vite-plus/test";
import { page } from "vite-plus/test/browser";

import { AppSidebar } from "#/features/layout/app-sidebar.tsx";
import { renderSidebar } from "#/testing/render-sidebar.tsx";

describe("AppSidebar", () => {
  it("links to the todos and to the administration, for an admin", async () => {
    await renderSidebar(AppSidebar, "admin");

    await expect.element(page.getByRole("link", { name: "Todos" })).toBeVisible();
    await expect
      .element(page.getByRole("link", { name: "Administration" }))
      .toHaveAttribute("href", "/admin");
  });

  it("does not link to the administration for a User of another Role", async () => {
    await renderSidebar(AppSidebar, "user");

    await expect.element(page.getByRole("link", { name: "Todos" })).toBeVisible();
    expect(page.getByRole("link", { name: "Administration" }).elements()).toEqual([]);
  });

  it("links to the settings from the menu of the Current User", async () => {
    await renderSidebar(AppSidebar, "user");

    await page.getByRole("button", { name: "someone@quack.dev" }).click();

    await expect
      .element(page.getByRole("menuitem", { name: "Settings" }))
      .toHaveAttribute("href", "/app/settings/profile");
  });

  it.each(["left", "right"] as const)(
    "sits on the %s when the Current User prefers it",
    async (side) => {
      await renderSidebar(AppSidebar, "user", { sidebarSide: side });

      const edgeOf = () => {
        const panel = document.querySelector("[data-slot=sidebar-container]");
        if (!(panel instanceof HTMLElement)) throw new Error("No sidebar is drawn.");
        const { left, right } = panel.getBoundingClientRect();
        return side === "left" ? left : window.innerWidth - right;
      };
      await expect.poll(edgeOf).toBe(0);
    },
  );
});

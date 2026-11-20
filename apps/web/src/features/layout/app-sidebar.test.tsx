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
});

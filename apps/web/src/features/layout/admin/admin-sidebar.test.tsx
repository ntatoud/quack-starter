import { describe, expect, it } from "vite-plus/test";
import { page } from "vite-plus/test/browser";

import { AdminSidebar } from "#/features/layout/admin/admin-sidebar.tsx";
import { renderSidebar } from "#/testing/render-sidebar.tsx";

describe("AdminSidebar", () => {
  it("links to the users, to the API docs in a new tab, and back to the app", async () => {
    await renderSidebar(AdminSidebar, "admin");

    await expect
      .element(page.getByRole("link", { name: "Users" }))
      .toHaveAttribute("href", "/admin/users");
    await expect
      .element(page.getByRole("link", { name: "Back to the app" }))
      .toHaveAttribute("href", "/app");
    await expect
      .element(page.getByRole("link", { name: "API docs, opens in a new tab" }))
      .toHaveAttribute("target", "_blank");
    expect(page.getByRole("link", { name: "Todos" }).elements()).toEqual([]);
  });
});

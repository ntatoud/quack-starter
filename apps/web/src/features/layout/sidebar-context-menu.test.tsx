import { describe, expect, it } from "vite-plus/test";
import { page } from "vite-plus/test/browser";

import { AppSidebar } from "#/features/layout/app-sidebar.tsx";
import { renderSidebar } from "#/testing/render-sidebar.tsx";

const emptySpace = () => {
  const content = document.querySelector("[data-slot=sidebar-content]");
  if (!(content instanceof HTMLElement)) throw new Error("The sidebar has no content.");
  const menu = content.querySelector("[data-sidebar=menu]")?.getBoundingClientRect();
  return {
    content,
    below: { x: 40, y: (menu?.bottom ?? 0) - content.getBoundingClientRect().top + 40 },
  };
};

const sidebarSide = () =>
  document.querySelector("[data-slot=sidebar][data-side]")?.getAttribute("data-side");

describe("the menu of the sidebar", () => {
  it("puts the sidebar on the right from a right click on its empty space, and back", async () => {
    const { preferences } = await renderSidebar(AppSidebar, "user");
    const { content, below } = emptySpace();

    await page.elementLocator(content).click({ button: "right", position: below });
    await page.getByRole("menuitem", { name: "Move right" }).click();

    await expect.poll(sidebarSide).toBe("right");
    expect(preferences.sidebarSide.get().value).toBe("right");

    await page.elementLocator(content).click({ button: "right", position: below });
    await page.getByRole("menuitem", { name: "Move left" }).click();

    await expect.poll(sidebarSide).toBe("left");
    expect(preferences.sidebarSide.get().value).toBe("left");
  });

  it("leaves a right click on a link to the browser", async () => {
    await renderSidebar(AppSidebar, "user");

    await page.getByRole("link", { name: "Todos" }).click({ button: "right" });

    expect(page.getByRole("menuitem", { name: /^Move/ }).elements()).toEqual([]);
  });
});

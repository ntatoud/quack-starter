import { describe, expect, it } from "vite-plus/test";
import { page, userEvent } from "vite-plus/test/browser";
import { render } from "vitest-browser-react";

import {
  Sidebar,
  SidebarContent,
  SidebarProvider,
  SidebarTrigger,
} from "@quack/ui/components/sidebar";

const setup = async (side: "left" | "right") => {
  await page.viewport(400, 700);
  await render(
    <SidebarProvider>
      <Sidebar side={side}>
        <SidebarContent>
          <a href="/somewhere">Somewhere</a>
        </SidebarContent>
      </Sidebar>
      <SidebarTrigger />
    </SidebarProvider>,
  );
};

describe("Sidebar on a narrow screen", () => {
  it.each(["left", "right"] as const)(
    "opens as a sheet from the %s and closes with Escape",
    async (side) => {
      await setup(side);
      expect(page.getByRole("dialog").elements()).toHaveLength(0);

      await page.getByRole("button", { name: "Toggle Sidebar" }).click();

      const sheet = page.getByRole("dialog", { name: "Sidebar" });
      await expect.element(sheet).toBeVisible();
      await expect.element(sheet).toHaveAttribute("data-side", side);
      await expect.element(page.getByRole("link", { name: "Somewhere" })).toBeVisible();
      // Once it has slid in, it rests against its edge.
      await expect
        .poll(() => {
          const { left, right } = sheet.element().getBoundingClientRect();
          return side === "left" ? left : window.innerWidth - right;
        })
        .toBe(0);

      await userEvent.keyboard("{Escape}");
      await expect.poll(() => page.getByRole("dialog").elements()).toHaveLength(0);
    },
  );
});

describe("Sidebar on a wide screen", () => {
  it("collapses and expands with Mod+B, which its trigger tells assistive tech", async () => {
    await page.viewport(1200, 700);
    const screen = await render(
      <SidebarProvider>
        <Sidebar collapsible="icon">
          <SidebarContent>
            <a href="/somewhere">Somewhere</a>
          </SidebarContent>
        </Sidebar>
        <SidebarTrigger />
      </SidebarProvider>,
    );
    const sidebar = () => screen.container.querySelector("[data-slot=sidebar][data-state]");
    const mod = navigator.platform.startsWith("Mac") ? "Meta" : "Control";

    await expect
      .element(page.getByRole("button", { name: "Toggle Sidebar" }))
      .toHaveAttribute("aria-keyshortcuts", `${mod}+B`);
    expect(sidebar()).toHaveAttribute("data-state", "expanded");

    await userEvent.keyboard(`{${mod}>}b{/${mod}}`);
    await expect.poll(() => sidebar()?.getAttribute("data-state")).toBe("collapsed");

    await userEvent.keyboard(`{${mod}>}b{/${mod}}`);
    await expect.poll(() => sidebar()?.getAttribute("data-state")).toBe("expanded");
  });
});

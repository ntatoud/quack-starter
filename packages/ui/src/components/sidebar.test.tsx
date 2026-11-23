import { setPlatform } from "@ui-sdk/core/testing";
import { describe, expect, it } from "vite-plus/test";
import { page, userEvent } from "vite-plus/test/browser";
import { render } from "vitest-browser-react";

import {
  Sidebar,
  SidebarContent,
  SidebarProvider,
  SidebarTrigger,
} from "@quack/ui/components/sidebar";

const renderSidebar = (props: Pick<React.ComponentProps<typeof Sidebar>, "side" | "collapsible">) =>
  render(
    <SidebarProvider>
      <Sidebar {...props}>
        <SidebarContent>
          <a href="/somewhere">Somewhere</a>
        </SidebarContent>
      </Sidebar>
      <SidebarTrigger />
    </SidebarProvider>,
  );

describe("Sidebar on a narrow screen", () => {
  it.each(["left", "right"] as const)(
    "opens as a sheet from the %s and closes with Escape",
    async (side) => {
      await page.viewport(400, 700);
      await renderSidebar({ side });
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
  it.each([
    ["apple", "Meta"],
    ["other", "Control"],
  ] as const)(
    "collapses and expands, on %s, with %s+B, which its trigger tells assistive tech",
    async (platform, mod) => {
      setPlatform(platform);
      await page.viewport(1200, 700);

      const screen = await renderSidebar({ collapsible: "icon" });

      const sidebar = () => screen.container.querySelector("[data-slot=sidebar][data-state]");

      await expect
        .element(page.getByRole("button", { name: "Toggle Sidebar" }))
        .toHaveAttribute("aria-keyshortcuts", `${mod}+B`);
      expect(sidebar()).toHaveAttribute("data-state", "expanded");

      await userEvent.keyboard(`{${mod}>}b{/${mod}}`);
      await expect.poll(() => sidebar()?.getAttribute("data-state")).toBe("collapsed");

      await userEvent.keyboard(`{${mod}>}b{/${mod}}`);
      await expect.poll(() => sidebar()?.getAttribute("data-state")).toBe("expanded");
    },
  );
});

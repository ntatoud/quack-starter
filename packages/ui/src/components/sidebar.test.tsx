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

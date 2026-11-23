import { describe, expect, it } from "vite-plus/test";
import { page } from "vite-plus/test/browser";
import { render } from "vitest-browser-react";

import { Toaster, toast } from "@quack/ui/components/toast";

// The toasts of `toast()` live in one queue for the page, kept from a test to the next: each test names its own.
describe("Toaster", () => {
  it("shows a toast named by its title, with its description", async () => {
    await render(<Toaster />);

    toast.success("Password changed", { description: "Sign in with your new password." });

    const shown = page.getByRole("listitem", { name: "Password changed" });

    await expect.element(shown).toBeVisible();
    await expect.element(shown).toMatchTextContent("Sign in with your new password.");
  });

  it("removes a toast on its Close button", async () => {
    await render(<Toaster />);

    toast.success("Saved");
    const shown = page.getByRole("listitem", { name: "Saved" });

    await shown.getByRole("button", { name: "Close" }).click();

    await expect.element(shown).not.toBeInTheDocument();
  });
});

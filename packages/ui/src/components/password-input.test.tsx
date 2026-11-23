import { describe, expect, it } from "vite-plus/test";
import { page, userEvent } from "vite-plus/test/browser";
import { render } from "vitest-browser-react";

import {
  PasswordInput,
  PasswordInputControl,
  PasswordInputToggle,
} from "@quack/ui/components/password-input";
import { elementOf, slot } from "@quack/ui/testing/dom";
import { EyeIcon } from "lucide-react";

const setup = () =>
  render(
    <PasswordInput>
      <PasswordInputControl aria-label="Password" />
      <PasswordInputToggle aria-label="Show password">
        <EyeIcon aria-hidden="true" />
      </PasswordInputToggle>
    </PasswordInput>,
  );

const input = () => page.getByLabelText("Password", { exact: true });
const toggle = () => page.getByRole("button", { name: "Show password" });

describe("PasswordInput", () => {
  it("hides the password until its toggle shows it, and says which it does", async () => {
    await setup();
    await userEvent.type(input(), "hunter2");
    await expect.element(input()).toHaveAttribute("type", "password");
    await expect.element(toggle()).toHaveAttribute("aria-pressed", "false");

    await toggle().click();

    await expect.element(input()).toHaveAttribute("type", "text");
    await expect.element(input()).toHaveValue("hunter2");
    await expect.element(toggle()).toHaveAttribute("aria-pressed", "true");
  });

  it("toggles from the keyboard, after the input in the tab order", async () => {
    await setup();

    await userEvent.keyboard("{Tab}{Tab}");
    await expect.element(toggle()).toHaveFocus();
    await userEvent.keyboard(" ");

    await expect.element(input()).toHaveAttribute("type", "text");
  });

  it("sits in one frame with the input", async () => {
    await setup();
    const frame = slot("input-group");

    expect(frame).toContainElement(elementOf(HTMLInputElement, input().element()));
    expect(frame).toContainElement(elementOf(HTMLButtonElement, toggle().element()));
  });
});

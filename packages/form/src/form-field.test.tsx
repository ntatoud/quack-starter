import { describe, expect, it } from "vite-plus/test";
import { page } from "vite-plus/test/browser";
import { render } from "vitest-browser-react";

import { NameForm } from "#/testing/name-form.tsx";

const height = (element: Element) => element.getBoundingClientRect().height;

describe("field.Root", () => {
  it.for([
    { size: "sm", pixels: 28 },
    { size: "md", pixels: 32 },
    { size: "lg", pixels: 36 },
  ] as const)("gives the control the height of a $size button", async ({ size, pixels }) => {
    await render(<NameForm size={size} />);

    expect(height(page.getByRole("textbox", { name: "Name" }).element())).toBe(pixels);
    expect(height(page.getByRole("button", { name: "Save" }).element())).toBe(pixels);
  });
});

describe("field.Label", () => {
  it("names the control, and focuses it when clicked", async () => {
    await render(<NameForm />);
    const input = page.getByRole("textbox", { name: "Name" });

    await page.getByText("Name").click();

    await expect.element(input).toHaveFocus();
  });

  it("still names the control when it is visually hidden", async () => {
    await render(<NameForm labelClassName="sr-only" />);

    await expect.element(page.getByRole("textbox", { name: "Name" })).toBeVisible();
    expect(height(page.getByText("Name").element())).toBe(1);
  });
});

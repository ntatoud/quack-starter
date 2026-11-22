import { afterEach, describe, expect, it } from "vite-plus/test";
import { cdp, page } from "vite-plus/test/browser";
import { render } from "vitest-browser-react";

type ColorScheme = "light" | "dark";

const emulateColorScheme = (value: ColorScheme) =>
  cdp().send("Emulation.setEmulatedMedia", {
    features: [{ name: "prefers-color-scheme", value }],
  });

afterEach(async () => {
  document.documentElement.removeAttribute("data-color-scheme");
  await emulateColorScheme("light");
});

// `null` is a page whose root has no `data-color-scheme`, as before the Preferences are read.
const setup = async (choice: "system" | ColorScheme | null, system: ColorScheme) => {
  await emulateColorScheme(system);

  if (choice !== null) document.documentElement.setAttribute("data-color-scheme", choice);
  await render(
    <div data-testid="box" className="bg-background dark:border-2">
      Box
    </div>,
  );
  const box = page.getByTestId("box").element();

  return {
    background: () => getComputedStyle(box).backgroundColor,
    isDarkVariant: () => getComputedStyle(box).borderTopWidth === "2px",
  };
};

const lightBackground = "oklch(1 0 0)";
const darkBackground = "oklch(0.145 0 0)";

describe("the theme", () => {
  it("is light with `light`, on a dark system", async () => {
    const box = await setup("light", "dark");

    expect(box.background()).toBe(lightBackground);
    expect(box.isDarkVariant()).toBe(false);
  });

  it("is dark with `dark`, on a light system", async () => {
    const box = await setup("dark", "light");

    expect(box.background()).toBe(darkBackground);
    expect(box.isDarkVariant()).toBe(true);
  });

  it.each([
    ["light", lightBackground, false],
    ["dark", darkBackground, true],
  ] as const)("follows a %s system with `system`", async (system, background, isDark) => {
    const box = await setup("system", system);

    expect(box.background()).toBe(background);
    expect(box.isDarkVariant()).toBe(isDark);
  });

  it.each([
    ["light", lightBackground],
    ["dark", darkBackground],
  ] as const)("follows a %s system without a choice", async (system, background) => {
    const box = await setup(null, system);

    expect(box.background()).toBe(background);
  });

  it("gives a part of the page its own scheme", async () => {
    await setup("light", "light");
    await render(
      <div data-color-scheme="dark">
        <div data-testid="part" className="bg-background">
          Part
        </div>
      </div>,
    );

    expect(getComputedStyle(page.getByTestId("part").element()).backgroundColor).toBe(
      darkBackground,
    );
  });
});

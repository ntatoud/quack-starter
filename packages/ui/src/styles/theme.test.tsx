import { afterEach, describe, expect, it } from "vite-plus/test";
import { cdp, page } from "vite-plus/test/browser";
import { render } from "vitest-browser-react";

type ColorScheme = "light" | "dark";

const emulateColorScheme = (value: ColorScheme) =>
  cdp().send("Emulation.setEmulatedMedia", {
    features: [{ name: "prefers-color-scheme", value }],
  });

afterEach(async () => {
  document.documentElement.className = "";
  await emulateColorScheme("light");
});

// `null` is a page whose root has no theme class, as before the Preferences are read.
const setup = async (themeClass: "system" | ColorScheme | null, system: ColorScheme) => {
  await emulateColorScheme(system);
  document.documentElement.className = themeClass ?? "";
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
  it.each(["light", "dark"] as const)(
    "is light without a theme class, on a %s system",
    async (system) => {
      const box = await setup(null, system);

      expect(box.background()).toBe(lightBackground);
      expect(box.isDarkVariant()).toBe(false);
    },
  );

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
});

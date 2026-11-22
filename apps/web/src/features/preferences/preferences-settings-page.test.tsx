import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { page } from "vite-plus/test/browser";
import { render } from "vitest-browser-react";

import type { PreferenceValues } from "#/features/preferences/preferences.ts";
import { PreferencesSettingsPage } from "#/features/preferences/preferences-settings-page.tsx";
import { testProviders } from "#/testing/test-providers.tsx";

const fetch = vi.fn<typeof globalThis.fetch>();

vi.stubGlobal("fetch", fetch);

afterEach(() => {
  fetch.mockClear();
});

const setup = async (values: Partial<PreferenceValues> = {}) => {
  const { Providers, preferences } = testProviders(values);
  await render(
    <Providers>
      <PreferencesSettingsPage />
    </Providers>,
  );

  return {
    preferences,
    theme: page.getByRole("radiogroup", { name: "Theme" }),
    sidebar: page.getByRole("radiogroup", { name: "Sidebar" }),
  };
};

describe("PreferencesSettingsPage", () => {
  it("follows the operating system's theme, with the sidebar on the left, by default", async () => {
    const { theme, sidebar } = await setup();

    await expect.element(theme.getByRole("radio", { name: "System" })).toBeChecked();
    await expect.element(theme).toHaveAccessibleDescription(/on this device/);
    await expect.element(sidebar.getByRole("radio", { name: "Left" })).toBeChecked();
    await expect.element(sidebar).toHaveAccessibleDescription(/on this device/);
  });

  it("starts from the Preferences of the device", async () => {
    const { theme, sidebar } = await setup({ colorScheme: "dark", sidebarSide: "right" });

    await expect.element(theme.getByRole("radio", { name: "Dark" })).toBeChecked();
    await expect.element(sidebar.getByRole("radio", { name: "Right" })).toBeChecked();
  });

  it("applies a choice as soon as it is made, with no button and no request", async () => {
    const { preferences, theme, sidebar } = await setup();

    await theme.getByRole("radio", { name: "Dark" }).click();
    await sidebar.getByRole("radio", { name: "Right" }).click();

    await expect.poll(() => preferences.colorScheme.get().value).toBe("dark");
    expect(preferences.sidebarSide.get().value).toBe("right");
    expect(page.getByRole("button", { name: "Save" }).elements()).toEqual([]);
    expect(fetch).not.toHaveBeenCalled();
  });
});

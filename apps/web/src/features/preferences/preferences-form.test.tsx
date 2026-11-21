import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { page } from "vite-plus/test/browser";
import { render } from "vitest-browser-react";

import { PreferencesForm } from "#/features/preferences/preferences-form.tsx";
import { type PreferenceValues, Preferences } from "#/features/preferences/preferences.ts";
import { preferencesQueryOptions } from "#/features/preferences/preferences-store.ts";
import { testProviders } from "#/testing/test-providers.tsx";

const fetch = vi.fn<typeof globalThis.fetch>();
vi.stubGlobal("fetch", fetch);

afterEach(() => {
  fetch.mockClear();
});

const setup = async (preferences: Partial<PreferenceValues> = {}) => {
  const { Providers, queryClient, preferencesStore } = testProviders(preferences);
  await render(
    <Providers>
      <PreferencesForm preferences={preferencesStore.read()} />
    </Providers>,
  );
  return {
    applied: () => queryClient.getQueryData(preferencesQueryOptions(preferencesStore).queryKey),
    stored: () => preferencesStore.read(),
    rightSidebarSwitch: page.getByRole("switch", { name: "Right sidebar" }),
    themeSelect: page.getByRole("combobox", { name: "Theme" }),
  };
};

describe("PreferencesForm", () => {
  it("starts from the Preferences of the device: the sidebar on the left by default", async () => {
    const form = await setup();

    await expect.element(form.rightSidebarSwitch).not.toBeChecked();
    await expect.element(form.rightSidebarSwitch).toHaveAccessibleDescription(/on this device/);
  });

  it("keeps and applies a change as soon as it is made, with no button and no request", async () => {
    const form = await setup();

    await form.rightSidebarSwitch.click();

    const right = { ...Preferences.defaults, "right-sidebar": true };
    await expect.poll(form.applied).toEqual(right);
    expect(form.stored()).toEqual(right);
    expect(page.getByRole("button", { name: "Save" }).elements()).toEqual([]);
    expect(fetch).not.toHaveBeenCalled();

    await form.rightSidebarSwitch.click();

    await expect.poll(form.applied).toEqual(Preferences.defaults);
    expect(form.stored()).toEqual(Preferences.defaults);
  });

  it("follows the operating system's theme by default", async () => {
    const form = await setup();

    await expect.poll(() => form.themeSelect.element().textContent).toMatch(/^System/);
    await expect.element(form.themeSelect).toHaveAccessibleDescription(/on this device/);
  });

  it("keeps and applies a theme as soon as it is chosen", async () => {
    const form = await setup();

    await form.themeSelect.click();
    await page.getByRole("option", { name: "Dark" }).click();

    const dark = { ...Preferences.defaults, theme: "dark" };
    await expect.poll(form.applied).toEqual(dark);
    expect(form.stored()).toEqual(dark);
    expect(fetch).not.toHaveBeenCalled();
  });
});

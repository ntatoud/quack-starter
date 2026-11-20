import { describe, expect, it } from "vite-plus/test";
import { page } from "vite-plus/test/browser";
import { render } from "vitest-browser-react";

import { Preferences } from "#/features/preferences/preferences.ts";
import {
  usePreference,
  usePreferences,
  useSavePreferences,
} from "#/features/preferences/use-preference.ts";
import { testProviders } from "#/testing/test-providers.tsx";

function RightSidebar() {
  const rightSidebar = usePreference("right-sidebar");
  const preferences = usePreferences();
  const savePreferences = useSavePreferences();

  return (
    <button
      type="button"
      onClick={() => savePreferences({ ...preferences, "right-sidebar": !rightSidebar })}
    >
      {rightSidebar ? "On the right" : "On the left"}
    </button>
  );
}

describe("the hooks of the Preferences", () => {
  it("read a Preference of the device", async () => {
    const { Providers } = testProviders({ "right-sidebar": true });
    await render(
      <Providers>
        <RightSidebar />
      </Providers>,
    );

    await expect.element(page.getByRole("button")).toHaveTextContent("On the right");
  });

  it("save the Preferences in the store, and every reader gets them at once", async () => {
    const { Providers, preferencesStore } = testProviders();
    await render(
      <Providers>
        <RightSidebar />
      </Providers>,
    );

    await page.getByRole("button", { name: "On the left" }).click();

    await expect.element(page.getByRole("button")).toHaveTextContent("On the right");
    expect(preferencesStore.read()).toEqual({ ...Preferences.defaults, "right-sidebar": true });
  });
});

import { describe, expect, it } from "vite-plus/test";
import { page } from "vite-plus/test/browser";
import { render } from "vitest-browser-react";

import { Preferences } from "#/features/preferences/preferences.ts";
import { preferencesQueryKey } from "#/features/preferences/preferences-store.ts";
import { usePreference, useSetPreference } from "#/features/preferences/use-preference.ts";
import { testProviders } from "#/testing/test-providers.tsx";

function RightSidebar() {
  const isRightSidebar = usePreference("right-sidebar");
  const setPreference = useSetPreference();

  return (
    <button type="button" onClick={() => setPreference("right-sidebar", !isRightSidebar)}>
      {isRightSidebar ? "On the right" : "On the left"}
    </button>
  );
}

const renderWith = (providers: ReturnType<typeof testProviders>) =>
  render(
    <providers.Providers>
      <RightSidebar />
    </providers.Providers>,
  );

describe("the hooks of the Preferences", () => {
  it("read a Preference of the device", async () => {
    await renderWith(testProviders({ "right-sidebar": true }));

    await expect.element(page.getByRole("button")).toHaveTextContent("On the right");
  });

  it("read the store at once when the cache does not hold them, as the browser starts", async () => {
    const providers = testProviders({ "right-sidebar": true });
    providers.queryClient.removeQueries({ queryKey: preferencesQueryKey });

    await renderWith(providers);

    expect(page.getByRole("button").element().textContent).toBe("On the right");
  });

  it("set a Preference in the store, and every reader gets it at once", async () => {
    const providers = testProviders();
    await renderWith(providers);

    await page.getByRole("button", { name: "On the left" }).click();

    await expect.element(page.getByRole("button")).toHaveTextContent("On the right");
    expect(providers.preferencesStore.read()).toEqual({
      ...Preferences.defaults,
      "right-sidebar": true,
    });
  });

  it("keep what the store holds when one Preference is set, a change made in another tab included", async () => {
    const providers = testProviders();
    await renderWith(providers);
    const changedElsewhere = { ...Preferences.defaults, "right-sidebar": true };
    providers.preferencesStore.write(changedElsewhere);

    await page.getByRole("button", { name: "On the left" }).click();

    expect(providers.preferencesStore.read()).toEqual(changedElsewhere);
  });
});

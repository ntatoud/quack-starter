import {
  createColorScheme,
  createCookieStorage,
  createPreference,
  type ValueStorage,
} from "@ui-sdk/core";
import { usePreference } from "@ui-sdk/react/preferences";
import { createIsomorphicFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { createContext, use } from "react";

type StorageOf = (name: string) => ValueStorage;

const storageOption = (storageOf: StorageOf | undefined, name: string) =>
  storageOf === undefined ? {} : { storage: storageOf(name) };

/** Without a storage, a choice lasts until the page closes, as in a test. */
export const createPreferences = (storageOf?: StorageOf) => ({
  colorScheme: createColorScheme({ global: true, ...storageOption(storageOf, "color-scheme") }),
  sidebarSide: createPreference({
    values: ["left", "right"],
    defaultValue: "left",
    attribute: "data-sidebar-side",
    ...storageOption(storageOf, "sidebar-side"),
  }),
});

export type Preferences = ReturnType<typeof createPreferences>;

export type PreferenceValues = {
  readonly [K in keyof Preferences]: ReturnType<Preferences[K]["get"]>["value"];
};

// The browser storage reads `document.cookie` itself.
const requestCookie = createIsomorphicFn()
  .server(() => getRequestHeader("cookie"))
  .client(() => undefined);

/**
 * In cookies, not in the browser storage: the server render reads them, so it draws the page as the browser will.
 * Created once per request on the server, so a visitor never gets the choices of another.
 */
export const cookiePreferences = () => {
  const cookie = requestCookie() ?? null;
  return createPreferences((name) => createCookieStorage(name, { cookie }));
};

export const PreferencesContext = createContext<Preferences | null>(null);

export const usePreferences = (): Preferences => {
  const preferences = use(PreferencesContext);
  if (preferences === null) throw new Error("usePreferences needs a PreferencesContext.");
  return preferences;
};

export const useSidebarSide = () => usePreference(usePreferences().sidebarSide).value;

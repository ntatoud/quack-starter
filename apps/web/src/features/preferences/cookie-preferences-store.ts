import { createIsomorphicFn } from "@tanstack/react-start";
import { getCookie } from "@tanstack/react-start/server";
import { Duration, Schema } from "effect";

import { type PreferenceValues, Preferences } from "#/features/preferences/preferences.ts";
import type { PreferencesStore } from "#/features/preferences/preferences-store.ts";

const COOKIE_NAME = "preferences";
const maxAge = Duration.toSeconds(Duration.days(365));
const encode = Schema.encodeSync(Preferences.Values);

const parseJson = (text: string): unknown => {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
};

export const parsePreferencesCookie = (decodedValue: string | undefined): PreferenceValues =>
  Preferences.decodeWithDefaults(decodedValue === undefined ? undefined : parseJson(decodedValue));

export const serializePreferencesCookie = (
  values: PreferenceValues,
  { secure }: { secure: boolean },
) =>
  [
    `${COOKIE_NAME}=${encodeURIComponent(JSON.stringify(encode(values)))}`,
    "Path=/",
    `Max-Age=${maxAge}`,
    "SameSite=Lax",
    ...(secure ? ["Secure"] : []),
  ].join("; ");

const readCookie = createIsomorphicFn()
  .server(() => getCookie(COOKIE_NAME))
  .client(() => {
    const prefix = `${COOKIE_NAME}=`;
    const found = document.cookie.split("; ").find((cookie) => cookie.startsWith(prefix));
    return found === undefined ? undefined : decodeURIComponent(found.slice(prefix.length));
  });

/** In a cookie, not in the browser storage: the server render reads it, so it draws the page as the browser will. */
export const cookiePreferencesStore: PreferencesStore = {
  read: () => parsePreferencesCookie(readCookie()),
  write: (values) => {
    document.cookie = serializePreferencesCookie(values, {
      secure: location.protocol === "https:",
    });
  },
};

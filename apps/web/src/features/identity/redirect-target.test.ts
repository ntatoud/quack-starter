import { describe, expect, it } from "vite-plus/test";

import { redirectTarget } from "#/features/identity/redirect-target.ts";

describe("redirectTarget", () => {
  it("leads to /app when the sign-in page has no redirect", () => {
    expect(redirectTarget(undefined)).toBe("/app");
    expect(redirectTarget("")).toBe("/app");
  });

  it("keeps a path of the app, with its search and hash", () => {
    expect(redirectTarget("/")).toBe("/");
    expect(redirectTarget("/todos")).toBe("/todos");
    expect(redirectTarget("/todos/42?filter=done&page=2#last")).toBe(
      "/todos/42?filter=done&page=2#last",
    );
  });

  it("keeps a path that only names another site", () => {
    expect(redirectTarget("/https://evil.example")).toBe("/https://evil.example");
    expect(redirectTarget("/todos?next=https://evil.example")).toBe(
      "/todos?next=https://evil.example",
    );
    expect(redirectTarget("/%2F%2Fevil.example")).toBe("/%2F%2Fevil.example");
  });

  it.each([
    ["an absolute URL", "https://evil.example/todos"],
    ["an absolute URL in another case", "HTTPS://evil.example"],
    ["a URL with no slashes", "https:evil.example"],
    ["a protocol-relative URL", "//evil.example/todos"],
    ["a backslash the browser reads as a slash", "/\\evil.example"],
    ["two backslashes", "\\\\evil.example"],
    ["a tab the browser drops", "/\t/evil.example"],
    ["a line break the browser drops", "/\n/evil.example"],
    ["a leading space", " //evil.example"],
    ["a dot segment that resolves to a protocol-relative URL", "/.//evil.example"],
    ["a parent segment that resolves to one", "/todos/..//evil.example"],
    ["an encoded dot segment that resolves to one", "/%2e//evil.example"],
    ["a dot segment before a backslash", "/./\\evil.example"],
    ["a dot segment before a tab the browser drops", "/.\t//evil.example"],
    ["a script", "javascript:alert(1)"],
    ["a data URL", "data:text/html,<script>alert(1)</script>"],
    ["a relative path", "todos"],
    ["a path relative to the current one", "../todos"],
    ["a search alone", "?redirect=/todos"],
  ])("leads to /app for %s", (_what, redirect) => {
    expect(redirectTarget(redirect)).toBe("/app");
  });
});

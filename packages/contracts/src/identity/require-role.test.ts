import { describe, expect, it } from "vite-plus/test";

import { RequireRole } from "#/identity/require-role.ts";

describe("RequireRole", () => {
  it("is one middleware per Role, the same at every call", () => {
    expect(RequireRole("admin")).toBe(RequireRole("admin"));
    expect(RequireRole("admin").key).not.toBe(RequireRole("user").key);
  });
});

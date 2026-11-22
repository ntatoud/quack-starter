import { describe, expect, it } from "vite-plus/test";

import { roleAllows } from "#/modules/identity/domain/permission.ts";

describe("roleAllows", () => {
  it("gives a user the Permissions on Todos, and none on Users", () => {
    expect(roleAllows("user", "todos:list")).toBe(true);
    expect(roleAllows("user", "todos:write")).toBe(true);
    expect(roleAllows("user", "todos:delete")).toBe(true);
    expect(roleAllows("user", "users:list")).toBe(false);
    expect(roleAllows("user", "users:read")).toBe(false);
    expect(roleAllows("user", "users:write")).toBe(false);
    expect(roleAllows("user", "users:delete")).toBe(false);
  });

  it("gives an admin every Permission", () => {
    expect(roleAllows("admin", "todos:list")).toBe(true);
    expect(roleAllows("admin", "todos:write")).toBe(true);
    expect(roleAllows("admin", "todos:delete")).toBe(true);
    expect(roleAllows("admin", "users:list")).toBe(true);
    expect(roleAllows("admin", "users:read")).toBe(true);
    expect(roleAllows("admin", "users:write")).toBe(true);
    expect(roleAllows("admin", "users:delete")).toBe(true);
  });
});

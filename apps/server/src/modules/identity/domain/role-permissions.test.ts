import { describe, expect, it } from "vite-plus/test";

import { rolePermissions } from "#/modules/identity/domain/role-permissions.ts";

describe("rolePermissions", () => {
  it("gives a user the Permissions on Todos and Habits, and none on Users", () => {
    expect(rolePermissions("user").has("todos:list")).toBe(true);
    expect(rolePermissions("user").has("todos:write")).toBe(true);
    expect(rolePermissions("user").has("todos:delete")).toBe(true);
    expect(rolePermissions("user").has("habits:read")).toBe(true);
    expect(rolePermissions("user").has("habits:check-in")).toBe(true);
    expect(rolePermissions("user").has("habits:write")).toBe(true);
    expect(rolePermissions("user").has("habits:delete")).toBe(true);
    expect(rolePermissions("user").has("users:list")).toBe(false);
    expect(rolePermissions("user").has("users:read")).toBe(false);
    expect(rolePermissions("user").has("users:write")).toBe(false);
    expect(rolePermissions("user").has("users:delete")).toBe(false);
  });

  it("gives an admin every Permission", () => {
    expect(rolePermissions("admin").has("todos:list")).toBe(true);
    expect(rolePermissions("admin").has("todos:write")).toBe(true);
    expect(rolePermissions("admin").has("todos:delete")).toBe(true);
    expect(rolePermissions("admin").has("users:list")).toBe(true);
    expect(rolePermissions("admin").has("users:read")).toBe(true);
    expect(rolePermissions("admin").has("users:write")).toBe(true);
    expect(rolePermissions("admin").has("users:delete")).toBe(true);
  });
});

import { Email, User, UserId, type UserStatus } from "@quack/contracts/identity/user";
import { DateTime, Option } from "effect";
import { describe, expect, it } from "vite-plus/test";

import { statusSetByAdmin } from "#/modules/identity/domain/user-status.ts";

const user = (status: UserStatus) =>
  new User({
    id: UserId.make("user-1"),
    email: Email.make("ada@example.com"),
    role: "user",
    status,
    createdAt: DateTime.makeUnsafe(0),
    lastSignInAt: null,
    onboardedAt: null,
    timeZone: DateTime.zoneMakeNamedUnsafe("Europe/Paris"),
    profile: null,
  });

describe("statusSetByAdmin", () => {
  it.each([
    ["active", "suspended"],
    ["suspended", "active"],
    ["active", "active"],
    ["suspended", "suspended"],
  ] as const)("moves a User from %s to %s", (from, to) => {
    expect(statusSetByAdmin(user(from), to)).toEqual(Option.some(user(to)));
  });

  it.each(["active", "suspended"] as const)("refuses to set %s on an invited User", (status) => {
    expect(statusSetByAdmin(user("invited"), status)).toEqual(Option.none());
  });
});

import type { Role } from "#/identity/user.ts";

/** Seeded by the server in dev only (`SEED_USERS`), and offered by the sign-in page of the dev build. */
export const devPassword = "quack-password";

export const devAccounts: Readonly<Record<Role, string>> = {
  user: "user@quack.dev",
  admin: "admin@quack.dev",
};

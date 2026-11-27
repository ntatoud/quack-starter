import { UsersHandlers } from "#/modules/users/lib/users-handlers.ts";

export { rolePermissions } from "#/modules/users/lib/role-permissions.ts";

export { seedUsers } from "#/modules/users/lib/users-seed.ts";

/** What the other modules ask of the Users: `Users.layer` requires the database. */
export { Users } from "#/modules/users/lib/users.ts";

/**
 * The Users endpoints of the `Api`. Requires `Users.layer`, kept apart: `Authentication`, which the endpoints sit
 * behind, asks `Users` too.
 */
export const UsersModule = UsersHandlers;

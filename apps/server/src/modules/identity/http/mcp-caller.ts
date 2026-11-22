import type { User } from "@quack/contracts/identity/user";
import type { Permission } from "@quack/contracts/permission";
import { Context } from "effect";

/**
 * The Current User of an MCP request, with the Permissions of their Grant. Only an in-process call of
 * the `Api` runs with it: `Authentication` then takes the caller from it, and reads no credential.
 */
export class McpCaller extends Context.Service<
  McpCaller,
  { readonly user: User; readonly permissions: ReadonlySet<Permission> }
>()("@quack/server/identity/McpCaller") {}

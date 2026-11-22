import { Context } from "effect";

import type { Caller } from "#/modules/identity/http/authorize.ts";

/**
 * The caller of an MCP request: a Grant's User, with the Grant's Permissions. Only an in-process call
 * of the `Api` runs with it: `Authentication` then takes the caller from it, and reads no credential.
 */
export class McpCaller extends Context.Service<McpCaller, Caller>()(
  "@quack/server/identity/McpCaller",
) {}

import { Context } from "effect";

/**
 * What an AI Client is told about a tool's effects. Each hint the server does not find here comes from
 * the method of the endpoint: `GET` reads only, `DELETE` destroys and is idempotent, `PUT` is idempotent.
 */
export interface McpToolHints {
  readonly readOnly?: boolean;
  readonly destructive?: boolean;
  readonly idempotent?: boolean;
}

/**
 * Offers an endpoint behind `Authentication` to AI Clients as an MCP tool, named `<group>_<endpoint>`.
 * Annotate a group to offer each of its endpoints, and an endpoint to override the hints of its group.
 * The endpoint's `OpenApi.Description` becomes the tool's, and is required.
 */
export class McpTool extends Context.Service<McpTool, McpToolHints>()("@quack/contracts/McpTool") {}

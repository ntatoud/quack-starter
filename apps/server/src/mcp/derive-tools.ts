import { Authentication } from "@quack/contracts/identity/authentication";
import { McpTool } from "@quack/contracts/mcp-tool";
import { Context, Effect, identity, Option, Result, Schema, SchemaAST } from "effect";
import { Tool } from "effect/ai";
import {
  HttpApi,
  type HttpApiEndpoint,
  type HttpApiGroup,
  type HttpApiMiddleware,
  HttpApiSchema,
  OpenApi,
} from "effect/http-api";

import { McpCaller } from "#/modules/identity/index.ts";

/** What a tool answers when its endpoint fails with an error of its own, or a Permission is missing. */
export const ToolFailure = Schema.Struct({ _tag: Schema.String, message: Schema.String });

/** What a tool is called with: the fields of its endpoint's params, query, and payload, in one record. */
export type ToolInput = Readonly<Record<string, Schema.Json>>;

/** What an endpoint answers a tool with: nothing for a `NoContent`. */
export type ToolSuccess = Schema.Json | undefined;

/** The parts of a request an endpoint reads its input from, each a record of its fields. */
export type EndpointRequest = Partial<Record<"params" | "query" | "payload", ToolInput>>;

export interface DerivedTool {
  readonly tool: Tool.Any;
  readonly group: HttpApiGroup.Top;
  readonly endpoint: HttpApiEndpoint.Top;
  /** What the endpoint and its middleware declare they fail with. */
  readonly errors: ReadonlyArray<Schema.Top>;
  /** Splits the tool's input between the parts of the endpoint's request. */
  readonly toRequest: (input: ToolInput) => EndpointRequest;
  /** Turns the endpoint's success into the tool's. */
  readonly toResult: (success: Schema.Json) => ToolSuccess;
}

type Fields = Readonly<Record<string, Schema.Top>>;

// MCP wants an object as structured content.
const successWrappers = {
  object: { schema: (success: Schema.Top) => success, toResult: identity },
  items: {
    schema: (success: Schema.Top) => Schema.Struct({ items: success }),
    toResult: (items: Schema.Json) => ({ items }),
  },
  none: { schema: (_: Schema.Top) => Schema.Void, toResult: () => undefined },
};

const successWrapper = (schemas: ReadonlyArray<Schema.Top>) => {
  const [schema] = schemas;

  if (schemas.length !== 1 || schema === undefined) return undefined;

  if (HttpApiSchema.isNoContent(schema.ast)) return successWrappers.none;
  const encoded = SchemaAST.toEncoded(schema.ast);

  if (SchemaAST.isArrays(encoded)) return successWrappers.items;

  if (SchemaAST.isObjects(encoded)) return successWrappers.object;

  return undefined;
};

// An endpoint keeps its params, query, and payload as the codecs of the wire (`Schema.toCodecStringTree`,
// `Schema.toCodecJson`), which keep the schema they were derived from as `schema`.
const withoutWireCodecs = (schema: Schema.Top): Schema.Top =>
  "schema" in schema && Schema.isSchema(schema.schema) ? withoutWireCodecs(schema.schema) : schema;

const structFields = (schema: Schema.Top): Fields | undefined => {
  const struct = withoutWireCodecs(schema);

  return SchemaAST.isObjects(struct.ast) && "fields" in struct
    ? (struct.fields as Fields)
    : undefined;
};

const jsonPayloadFields = (endpoint: HttpApiEndpoint.Top): Fields | undefined => {
  const [payload, ...others] = endpoint.payload.values();

  return payload !== undefined &&
    others.length === 0 &&
    payload.encoding._tag === "Json" &&
    payload.schemas.length === 1
    ? structFields(payload.schemas[0])
    : undefined;
};

/** The fields of each part of the request the endpoint reads, or why a tool cannot take them as input. */
const requestFields = (name: string, endpoint: HttpApiEndpoint.Top) => {
  const parts: Partial<Record<keyof EndpointRequest, Fields>> = {};
  const problems: Array<string> = [];

  for (const [part, schema] of [
    ["params", endpoint.params],
    ["query", endpoint.query],
  ] as const) {
    if (schema === undefined) continue;
    const fields = structFields(schema);

    if (fields === undefined) problems.push(`${name} takes ${part} that are not a Struct`);
    else parts[part] = fields;
  }

  if (endpoint.payload.size > 0) {
    const fields = jsonPayloadFields(endpoint);

    if (fields === undefined) problems.push(`${name} takes a payload that is not a JSON object`);
    else parts.payload = fields;
  }

  const seen = new Set<string>();

  for (const field of Object.values(parts).flatMap(Object.keys)) {
    if (seen.has(field)) problems.push(`${name} has the input field ${field} twice`);
    seen.add(field);
  }

  return { parts, problems };
};

/** An endpoint's hints refine its group's, rather than replace them; the method gives what neither says. */
const toolBehavior = (group: HttpApiGroup.Top, endpoint: HttpApiEndpoint.Top) => {
  const hints = {
    ...Option.getOrUndefined(Context.getOption(group.annotations, McpTool)),
    ...Option.getOrUndefined(Context.getOption(endpoint.annotations, McpTool)),
  };

  const method = endpoint.method;

  return {
    readOnly: hints.readOnly ?? method === "GET",
    destructive: hints.destructive ?? method === "DELETE",
    idempotent: hints.idempotent ?? (method === "PUT" || method === "DELETE"),
  };
};

const requestOf = (
  parts: Partial<Record<keyof EndpointRequest, Fields>>,
  args: ToolInput,
): EndpointRequest =>
  Object.fromEntries(
    Object.entries(parts).map(([part, fields]) => [
      part,
      Object.fromEntries(
        Object.keys(fields).flatMap((field) =>
          args[field] === undefined ? [] : [[field, args[field]]],
        ),
      ),
    ]),
  );

const deriveTool = (options: {
  readonly group: HttpApiGroup.Top;
  readonly endpoint: HttpApiEndpoint.Top;
  readonly middleware: ReadonlySet<HttpApiMiddleware.AnyService>;
  readonly successes: ReadonlyMap<number, ReadonlyArray<Schema.Top>>;
  readonly errors: ReadonlyMap<number, ReadonlyArray<Schema.Top>>;
}): Result.Result<DerivedTool, ReadonlyArray<string>> => {
  const { group, endpoint } = options;
  const name = `${group.identifier}_${endpoint.identifier}`;
  const description = Context.getOption(endpoint.annotations, OpenApi.Description);
  const successSchemas = [...options.successes.values()].flat();
  const wrapper = successWrapper(successSchemas);
  const { parts, problems } = requestFields(name, endpoint);

  if (![...options.middleware].some(({ key }) => key === Authentication.key)) {
    problems.push(`${name} is not behind Authentication`);
  }

  if (Option.isNone(description)) problems.push(`${name} has no OpenApi.Description`);

  if (wrapper === undefined) {
    problems.push(`${name} answers with what a tool cannot wrap in an object`);
  }

  if (
    problems.length > 0 ||
    Option.isNone(description) ||
    wrapper === undefined ||
    successSchemas[0] === undefined
  ) {
    return Result.fail(problems);
  }

  const input: Fields = Object.assign({}, ...Object.values(parts));
  const behavior = toolBehavior(group, endpoint);

  return Result.succeed({
    tool: Tool.make(name, {
      description: description.value,
      // An empty Struct accepts arrays too, so its JSON Schema has no object root.
      parameters: Object.keys(input).length === 0 ? Tool.EmptyParams : Schema.Struct(input),
      success: wrapper.schema(successSchemas[0]),
      failure: ToolFailure,
      dependencies: [McpCaller],
    })
      .annotate(Tool.Readonly, behavior.readOnly)
      .annotate(Tool.Destructive, behavior.destructive)
      .annotate(Tool.Idempotent, behavior.idempotent)
      .annotate(Tool.OpenWorld, false),
    group,
    endpoint,
    errors: [...options.errors.values()].flat(),
    toRequest: (args) => requestOf(parts, args),
    toResult: wrapper.toResult,
  });
};

/**
 * Derives a tool from each endpoint that opts in with `McpTool`. Dies, so the server does not start,
 * on an endpoint no tool can stand for, naming every such endpoint and why.
 */
export const deriveTools = <Id extends string, Groups extends HttpApiGroup.Constraint>(
  api: HttpApi.HttpApi<Id, Groups>,
) =>
  Effect.suspend(() => {
    const tools: Array<DerivedTool> = [];
    const problems: Array<string> = [];
    HttpApi.reflect(api, {
      onGroup: () => {},
      onEndpoint: (endpoint) => {
        if (Option.isNone(Context.getOption(endpoint.mergedAnnotations, McpTool))) return;
        Result.match(deriveTool(endpoint), {
          onSuccess: (tool) => tools.push(tool),
          onFailure: (endpointProblems) => problems.push(...endpointProblems),
        });
      },
    });

    return problems.length === 0
      ? Effect.succeed(tools)
      : Effect.die(new Error(`No MCP tool can stand for:\n${problems.join("\n")}`));
  });

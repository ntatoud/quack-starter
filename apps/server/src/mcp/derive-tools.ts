import { Authentication } from "@quack/contracts/identity/authentication";
import { McpTool } from "@quack/contracts/mcp-tool";
import { Context, Effect, Option, Schema, SchemaAST } from "effect";
import { Tool } from "effect/ai";
import {
  HttpApi,
  type HttpApiEndpoint,
  type HttpApiGroup,
  HttpApiSchema,
  OpenApi,
} from "effect/http-api";

import { McpCaller } from "#/modules/identity/index.ts";

/** What a tool answers when its endpoint fails with an error of its own, or a Permission is missing. */
export const ToolFailure = Schema.Struct({ _tag: Schema.String, message: Schema.String });

/**
 * MCP wants an object as structured content: an array success is wrapped as `{ items }`, and an empty
 * one gives none.
 */
export type SuccessShape = "object" | "items" | "none";

export interface DerivedTool {
  readonly tool: Tool.Any;
  readonly group: HttpApiGroup.Top;
  readonly endpoint: HttpApiEndpoint.Top;
  /** The names of the tool's input fields, by the part of the request each one goes to. */
  readonly input: {
    readonly params: ReadonlyArray<string>;
    readonly query: ReadonlyArray<string>;
    readonly payload: ReadonlyArray<string>;
  };
  readonly success: SuccessShape;
  /** What the endpoint and its middleware declare they fail with. */
  readonly errors: ReadonlyArray<Schema.Top>;
}

type Fields = Readonly<Record<string, Schema.Top>>;

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

const payloadFields = (endpoint: HttpApiEndpoint.Top): Fields | undefined => {
  const payloads = [...endpoint.payload.values()];
  if (payloads.length === 0) return {};
  const [payload] = payloads;
  return payloads.length === 1 &&
    payload !== undefined &&
    payload.encoding._tag === "Json" &&
    payload.schemas.length === 1
    ? structFields(payload.schemas[0])
    : undefined;
};

const successShape = (schemas: ReadonlyArray<Schema.Top>): SuccessShape | undefined => {
  const [schema] = schemas;
  if (schemas.length !== 1 || schema === undefined) return undefined;
  if (HttpApiSchema.isNoContent(schema.ast)) return "none";
  const encoded = SchemaAST.toEncoded(schema.ast);
  if (SchemaAST.isArrays(encoded)) return "items";
  if (SchemaAST.isObjects(encoded)) return "object";
  return undefined;
};

const successSchema = (schema: Schema.Top, shape: SuccessShape): Schema.Top => {
  switch (shape) {
    case "none":
      return Schema.Void;
    case "items":
      return Schema.Struct({ items: schema });
    case "object":
      return schema;
  }
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
      onEndpoint: ({ group, endpoint, mergedAnnotations, middleware, successes, errors }) => {
        const offered = Context.getOption(mergedAnnotations, McpTool);
        if (Option.isNone(offered)) return;
        const name = `${group.identifier}_${endpoint.identifier}`;
        const problemsBefore = problems.length;

        if (![...middleware].some(({ key }) => key === Authentication.key)) {
          problems.push(`${name} is not behind Authentication`);
        }
        const description = Context.getOption(endpoint.annotations, OpenApi.Description);
        if (Option.isNone(description)) {
          problems.push(`${name} has no OpenApi.Description`);
        }
        const params = endpoint.params === undefined ? {} : structFields(endpoint.params);
        const query = endpoint.query === undefined ? {} : structFields(endpoint.query);
        const payload = payloadFields(endpoint);
        if (params === undefined || query === undefined) {
          problems.push(`${name} takes path params or a query that are not a Struct`);
        }
        if (payload === undefined) {
          problems.push(`${name} takes a payload that is not a JSON object`);
        }
        const successSchemas = [...successes.values()].flat();
        const shape = successShape(successSchemas);
        if (shape === undefined) {
          problems.push(`${name} answers with what a tool cannot wrap in an object`);
        }

        const parts = [params ?? {}, query ?? {}, payload ?? {}];
        const seen = new Set<string>();
        for (const field of parts.flatMap(Object.keys)) {
          if (seen.has(field)) problems.push(`${name} has the input field ${field} twice`);
          seen.add(field);
        }
        if (problems.length > problemsBefore || shape === undefined) return;

        const method = endpoint.method;
        // An endpoint's hints refine its group's, rather than replace them.
        const hints = {
          ...Option.getOrUndefined(Context.getOption(group.annotations, McpTool)),
          ...Option.getOrUndefined(Context.getOption(endpoint.annotations, McpTool)),
        };
        tools.push({
          tool: Tool.make(name, {
            description: Option.getOrUndefined(description),
            // An empty Struct accepts arrays too, so its JSON Schema has no object root.
            parameters:
              seen.size === 0
                ? Tool.EmptyParams
                : Schema.Struct(Object.assign({}, ...parts) as Fields),
            success: successSchema(successSchemas[0]!, shape),
            failure: ToolFailure,
            dependencies: [McpCaller],
          })
            .annotate(Tool.Readonly, hints.readOnly ?? method === "GET")
            .annotate(Tool.Destructive, hints.destructive ?? method === "DELETE")
            .annotate(
              Tool.Idempotent,
              hints.idempotent ?? (method === "PUT" || method === "DELETE"),
            )
            .annotate(Tool.OpenWorld, false),
          group,
          endpoint,
          input: {
            params: Object.keys(params ?? {}),
            query: Object.keys(query ?? {}),
            payload: Object.keys(payload ?? {}),
          },
          success: shape,
          errors: [...errors.values()].flat(),
        });
      },
    });

    return problems.length === 0
      ? Effect.succeed(tools)
      : Effect.die(new Error(`No MCP tool can stand for:\n${problems.join("\n")}`));
  });

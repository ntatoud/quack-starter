import { assert, describe, it } from "@effect/vitest";
import { Api } from "@quack/contracts/api";
import { Authentication } from "@quack/contracts/identity/authentication";
import { McpTool } from "@quack/contracts/mcp-tool";
import { RequiredPermission } from "@quack/contracts/permission";
import { Cause, Effect, Exit, Schema } from "effect";
import { HttpApi, HttpApiEndpoint, HttpApiGroup, HttpApiSchema, OpenApi } from "effect/http-api";

import { deriveTools } from "#/mcp/derive-tools.ts";

const offered = (endpoint: HttpApiEndpoint.Constraint) =>
  HttpApi.make("probe").add(
    HttpApiGroup.make("probe").add(endpoint).middleware(Authentication).annotate(McpTool, {}),
  );

const defectOf = <Id extends string, Groups extends HttpApiGroup.Constraint>(
  api: HttpApi.HttpApi<Id, Groups>,
) =>
  Effect.gen(function* () {
    const exit = yield* Effect.exit(deriveTools(api));
    assert.isTrue(Exit.isFailure(exit));

    return Exit.isFailure(exit) ? Cause.pretty(exit.cause) : "";
  });

describe("deriveTools", () => {
  it.effect("derives one tool per endpoint of the Api that opts in, named <group>_<endpoint>", () =>
    Effect.gen(function* () {
      const tools = yield* deriveTools(Api);

      assert.deepStrictEqual(
        tools.map(({ tool }) => tool.name),
        ["todos_list", "todos_create", "todos_complete", "todos_remove"],
      );
    }),
  );

  it.effect("stops at an offered endpoint with no description", () =>
    Effect.gen(function* () {
      const defect = yield* defectOf(
        offered(HttpApiEndpoint.get("list", "/").annotate(RequiredPermission, "todos:list")),
      );

      assert.include(defect, "probe_list has no OpenApi.Description");
    }),
  );

  it.effect("stops at an offered endpoint whose path param and payload share a field", () =>
    Effect.gen(function* () {
      const defect = yield* defectOf(
        offered(
          HttpApiEndpoint.post("rename", "/:title", {
            params: { title: Schema.String },
            payload: Schema.Struct({ title: Schema.String }),
          })
            .annotate(OpenApi.Description, "Probes.")
            .annotate(RequiredPermission, "todos:list"),
        ),
      );

      assert.include(defect, "probe_rename has the input field title twice");
    }),
  );

  it.effect("stops at an offered endpoint whose payload is not JSON", () =>
    Effect.gen(function* () {
      const defect = yield* defectOf(
        offered(
          HttpApiEndpoint.post("upload", "/", {
            payload: Schema.String.pipe(HttpApiSchema.asText()),
          })
            .annotate(OpenApi.Description, "Probes.")
            .annotate(RequiredPermission, "todos:list"),
        ),
      );

      assert.include(defect, "probe_upload takes a payload that is not a JSON object");
    }),
  );

  it.effect(
    "stops at an offered endpoint whose success is neither an object, an array, nor empty",
    () =>
      Effect.gen(function* () {
        const defect = yield* defectOf(
          offered(
            HttpApiEndpoint.get("count", "/", { success: Schema.Number })
              .annotate(OpenApi.Description, "Probes.")
              .annotate(RequiredPermission, "todos:list"),
          ),
        );

        assert.include(defect, "probe_count answers with what a tool cannot wrap in an object");
      }),
  );

  it.effect("stops at an offered endpoint that is not behind Authentication", () =>
    Effect.gen(function* () {
      const defect = yield* defectOf(
        HttpApi.make("probe").add(
          HttpApiGroup.make("probe")
            .add(
              HttpApiEndpoint.get("open", "/")
                .annotate(OpenApi.Description, "Probes.")
                .annotate(RequiredPermission, "todos:list"),
            )
            .annotate(McpTool, {}),
        ),
      );

      assert.include(defect, "probe_open is not behind Authentication");
    }),
  );
});

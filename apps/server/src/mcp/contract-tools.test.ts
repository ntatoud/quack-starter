import { assert, layer } from "@effect/vitest";
import { Email, User, UserId } from "@quack/contracts/identity/user";
import type { Permission } from "@quack/contracts/permission";
import { ConfigProvider, DateTime, Effect, Layer } from "effect";
import { McpProtocol, McpServer, McpTest } from "effect/ai";
import { HttpServer } from "effect/http";

import { ContractTools } from "#/mcp/contract-tools.ts";
import { IdentityModule, McpCaller } from "#/modules/identity/index.ts";
import { SessionStoreMemory } from "#/modules/identity/testing/session-store-memory.ts";
import { UserRepositoryMemory } from "#/modules/identity/testing/user-repository-memory.ts";
import { SystemHandlers } from "#/modules/system/http/system-handlers.ts";
import { TodosModule } from "#/modules/todos/index.ts";
import { TodoRepositoryMemory } from "#/modules/todos/testing/todo-repository-memory.ts";

const ApiHandlers = Layer.mergeAll(SystemHandlers, TodosModule).pipe(
  Layer.provideMerge(IdentityModule),
  Layer.provide([UserRepositoryMemory, SessionStoreMemory, TodoRepositoryMemory]),
  Layer.provide(ConfigProvider.layer(ConfigProvider.fromUnknown({}))),
);

const everyTodosPermission: ReadonlyArray<Permission> = [
  "todos:list",
  "todos:write",
  "todos:delete",
];

/** An MCP client whose every request comes from a Grant of a new User, holding `permissions`. */
const clientWith = (name: string, permissions: ReadonlyArray<Permission> = everyTodosPermission) =>
  Effect.gen(function* () {
    const user = new User({
      id: UserId.make(name),
      email: Email.make(`${name}@example.com`),
      role: "user",
      status: "active",
      createdAt: yield* DateTime.now,
      lastSignInAt: null,
      onboardedAt: null,
      profile: null,
    });
    const asCaller = McpServer.middleware<{ provides: McpCaller }>()((effect) =>
      Effect.provideService(effect, McpCaller, { user, permissions: new Set(permissions) }),
    );
    const client = yield* McpTest.makeClient(ContractTools.pipe(Layer.provide(asCaller.layer)), {
      protocols: [McpProtocol.v2026_07_28],
    });
    return { client, user };
  });

const textOf = (content: ReadonlyArray<unknown>) =>
  content.map((block) => (block as { readonly text: string }).text).join("");

layer(Layer.mergeAll(ApiHandlers, HttpServer.layerServices))("ContractTools", (it) => {
  it.effect("lists the tools of the Todos, with their description, input, and hints", () =>
    Effect.gen(function* () {
      const { client } = yield* clientWith("ada-lists");

      const { tools } = yield* client.listTools();

      assert.deepStrictEqual(
        tools.map(({ name, description, annotations }) => ({
          name,
          description,
          readOnly: annotations?.readOnlyHint,
          destructive: annotations?.destructiveHint,
          idempotent: annotations?.idempotentHint,
        })),
        [
          {
            name: "todos_list",
            description: "Lists the Todos of the Current User, oldest first.",
            readOnly: true,
            destructive: false,
            idempotent: false,
          },
          {
            name: "todos_create",
            description: "Creates a Todo with this title, not completed yet.",
            readOnly: false,
            destructive: false,
            idempotent: false,
          },
          {
            name: "todos_complete",
            description: "Marks the Todo with this id as completed.",
            readOnly: false,
            destructive: false,
            idempotent: true,
          },
          {
            name: "todos_remove",
            description: "Removes the Todo with this id, for good.",
            readOnly: false,
            destructive: true,
            idempotent: true,
          },
        ],
      );
      const complete = tools.find(({ name }) => name === "todos_complete");
      assert.deepStrictEqual(complete?.inputSchema.required, ["id"]);
      assert.deepStrictEqual(Object.keys(complete?.inputSchema.properties ?? {}), ["id"]);
    }),
  );

  it.effect("creates a Todo the caller owns, and lists it wrapped as { items }", () =>
    Effect.gen(function* () {
      const { client, user } = yield* clientWith("grace-creates");

      const created = yield* client.callTool({
        name: "todos_create",
        arguments: { title: "Ship it" },
      });
      const listed = yield* client.callTool({ name: "todos_list", arguments: {} });

      assert.isFalse(created.isError);
      assert.deepInclude(created.structuredContent, {
        ownerId: user.id,
        title: "Ship it",
        completed: false,
      });
      assert.isString((created.structuredContent as { readonly createdAt: unknown }).createdAt);
      assert.deepStrictEqual(listed.structuredContent, { items: [created.structuredContent] });
    }),
  );

  it.effect("removes a Todo, and answers with no structured content", () =>
    Effect.gen(function* () {
      const { client } = yield* clientWith("hedy-removes");
      const created = yield* client.callTool({
        name: "todos_create",
        arguments: { title: "Gone" },
      });
      const { id } = created.structuredContent as { readonly id: string };

      const removed = yield* client.callTool({ name: "todos_remove", arguments: { id } });
      const listed = yield* client.callTool({ name: "todos_list", arguments: {} });

      assert.isFalse(removed.isError);
      assert.isUndefined(removed.structuredContent);
      assert.deepStrictEqual(listed.structuredContent, { items: [] });
    }),
  );

  it.effect("answers a Todo of another Owner as an error result, with its tag and message", () =>
    Effect.gen(function* () {
      const owner = yield* clientWith("joan-owns");
      const other = yield* clientWith("radia-other");
      const created = yield* owner.client.callTool({
        name: "todos_create",
        arguments: { title: "Mine" },
      });
      const { id } = created.structuredContent as { readonly id: string };

      const result = yield* other.client.callTool({ name: "todos_complete", arguments: { id } });

      assert.isTrue(result.isError);
      assert.deepStrictEqual(JSON.parse(textOf(result.content)), {
        _tag: "TodoNotFound",
        message: `No Todo has the id ${id}`,
      });
    }),
  );

  it.effect("hides the tools whose Permission the Grant lacks, and refuses a call to one", () =>
    Effect.gen(function* () {
      const { client } = yield* clientWith("mary-lists-only", ["todos:list"]);

      const { tools } = yield* client.listTools();
      const refused = yield* client
        .callTool({ name: "todos_create", arguments: { title: "Not allowed" } })
        .pipe(Effect.flip);
      const listed = yield* client.callTool({ name: "todos_list", arguments: {} });

      assert.deepStrictEqual(
        tools.map(({ name }) => name),
        ["todos_list"],
      );
      assert.include(refused.message, "todos_create");
      assert.deepStrictEqual(listed.structuredContent, { items: [] });
    }),
  );
});

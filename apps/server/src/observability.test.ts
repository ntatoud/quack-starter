import { Cause, ConfigProvider, Effect, Layer, Logger, References, Tracer } from "effect";
import { FetchHttpClient, HttpRouter, HttpServer } from "effect/http";
import { afterAll, describe, expect, it } from "vite-plus/test";

import { AuthorizationCodeStoreMemory } from "#/modules/identity/testing/authorization-code-store-memory.ts";
import { GrantStoreMemory } from "#/modules/identity/testing/grant-store-memory.ts";
import { SessionStoreMemory } from "#/modules/identity/testing/session-store-memory.ts";
import { UserRepositoryMemory } from "#/modules/identity/testing/user-repository-memory.ts";
import { TodoRepository } from "#/modules/todos/domain/todo-repository.ts";
import { requestLogger } from "#/observability.ts";
import { Routes } from "#/server.ts";

const spans: Array<Tracer.NativeSpan> = [];

const RecordingTracer = Layer.succeed(
  Tracer.Tracer,
  Tracer.make({
    span(options) {
      const span = new Tracer.NativeSpan(options);
      spans.push(span);

      return span;
    },
  }),
);

const entryOf = ({ logLevel, message, cause, fiber }: Logger.Options<unknown>) => ({
  level: logLevel,
  message,
  cause,
  annotations: fiber.getRef(References.CurrentLogAnnotations),
});

const entries: Array<ReturnType<typeof entryOf>> = [];

const RecordingLogger = Logger.layer([
  Logger.make((options) => {
    entries.push(entryOf(options));
  }),
]);

const todosCrash = "the todos table is on fire";

const BrokenTodoRepository = Layer.succeed(
  TodoRepository,
  TodoRepository.of({
    nextId: Effect.die(todosCrash),
    findAll: () => Effect.die(todosCrash),
    findById: () => Effect.die(todosCrash),
    save: () => Effect.die(todosCrash),
    remove: () => Effect.die(todosCrash),
  }),
);

const { handler, dispose } = HttpRouter.toWebHandler(
  Routes.pipe(
    Layer.provide([
      HttpServer.layerServices,
      UserRepositoryMemory,
      SessionStoreMemory,
      AuthorizationCodeStoreMemory,
      GrantStoreMemory,
      BrokenTodoRepository,
      ConfigProvider.layer(ConfigProvider.fromUnknown({ PUBLIC_URL: "https://quack.test" })),
      FetchHttpClient.layer,
    ]),
    Layer.provideMerge([RecordingTracer, RecordingLogger]),
  ),
  { disableLogger: true, middleware: (app) => requestLogger(app) },
);

afterAll(dispose);

const signUp = async (email: string) => {
  const response = await handler(
    new Request("http://api.test/api/sign-up", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password: "correct horse battery staple" }),
    }),
  );

  const user = (await response.json()) as { id: string };

  return { id: user.id, cookie: response.headers.getSetCookie()[0]?.split(";")[0] ?? "" };
};

const serverSpanOf = (path: string) =>
  spans.findLast((span) => span.kind === "server" && span.attributes.get("url.path") === path);

describe("observability", () => {
  it("leaves the health check out of the spans and the request lines", async () => {
    const response = await handler(new Request("http://api.test/api/health?probe=1"));

    expect(response.status).toBe(204);
    expect(serverSpanOf("/api/health")).toBeUndefined();
    expect(entries.filter((entry) => entry.annotations["http.path"] === "/api/health")).toEqual([]);
  });

  it("puts the id and the Role of the Current User on the span of the request", async () => {
    const { id, cookie } = await signUp("grace@example.com");

    await handler(new Request("http://api.test/api/me", { headers: { cookie } }));

    const span = serverSpanOf("/api/me");
    expect(span?.attributes.get("user.id")).toBe(id);
    expect(span?.attributes.get("user.role")).toBe("user");
  });

  it("writes no cookie nor authorization header on a span", async () => {
    const { cookie } = await signUp("hedy@example.com");

    await handler(
      new Request("http://api.test/api/me", {
        headers: { cookie, authorization: "Bearer a-token-nobody-must-read" },
      }),
    );

    const values = spans.flatMap((span) => [...span.attributes.values()].map(String));
    expect(values.filter((value) => value.includes(cookie.split("=")[1] ?? cookie))).toEqual([]);
    expect(values.filter((value) => value.includes("a-token-nobody-must-read"))).toEqual([]);
  });

  it("answers a defect with a 500, and logs it at Error with its cause and the trace of the request", async () => {
    const { cookie } = await signUp("radia@example.com");

    const response = await handler(
      new Request("http://api.test/api/todos", { headers: { cookie } }),
    );

    expect(response.status).toBe(500);

    const line = entries.find(
      (entry) => entry.annotations["http.path"] === "/api/todos" && entry.level === "Error",
    );

    expect(line?.annotations).toMatchObject({
      "http.method": "GET",
      "http.route": "/api/todos",
      "http.status": 500,
      trace_id: serverSpanOf("/api/todos")?.traceId,
    });
    expect(Cause.pretty(line?.cause ?? Cause.empty)).toContain(todosCrash);
  });
});

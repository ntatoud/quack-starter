import { Cause, ConfigProvider, Effect, Layer, Logger, References, Tracer } from "effect";
import { HttpClient, HttpClientResponse, HttpRouter, HttpServer } from "effect/http";
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

const clientId = "https://claude.example.com/oauth/client.json";
const redirectUri = "https://claude.example.com/api/mcp/auth_callback";
const resource = "https://quack.test/api/mcp";

// Every fetch gets the document of the AI Client: the only one the server makes is for it.
const AiClientDocument = Layer.succeed(
  HttpClient.HttpClient,
  HttpClient.make((request) =>
    Effect.succeed(
      HttpClientResponse.fromWeb(
        request,
        Response.json({
          client_id: clientId,
          client_name: "Claude",
          redirect_uris: [redirectUri],
          token_endpoint_auth_method: "none",
        }),
      ),
    ),
  ),
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
      AiClientDocument,
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

const post = (
  path: string,
  body: Readonly<Record<string, string | ReadonlyArray<string>>>,
  cookie: string,
) =>
  handler(
    new Request(new URL(path, "http://api.test"), {
      method: "POST",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify(body),
    }),
  );

/** The access token of a Grant the User of `cookie` approved, to list their Todos. */
const accessTokenOf = async (cookie: string) => {
  const request = {
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    // The pair of RFC 7636 appendix B.
    code_challenge: "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM",
    code_challenge_method: "S256",
    resource,
    scope: "todos:list",
  };

  const consent = (await (await post("/api/oauth/authorize/check", request, cookie)).json()) as {
    csrfToken: string;
    permissions: ReadonlyArray<string>;
  };

  const approved = await post("/api/oauth/authorize/approve", { ...request, ...consent }, cookie);
  const { redirectTo } = (await approved.json()) as { redirectTo: string };

  const token = await handler(
    new Request("http://api.test/api/oauth/token", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code: new URL(redirectTo).searchParams.get("code") ?? "",
        redirect_uri: redirectUri,
        client_id: clientId,
        code_verifier: "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk",
        resource,
      }),
    }),
  );

  return ((await token.json()) as { access_token: string }).access_token;
};

const callTool = (name: string, accessToken: string) =>
  handler(
    new Request("http://api.test/api/mcp", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json, text/event-stream",
        "mcp-protocol-version": "2026-07-28",
        "mcp-method": "tools/call",
        "mcp-name": name,
        authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "tools/call",
        params: {
          name,
          arguments: {},
          _meta: {
            "io.modelcontextprotocol/protocolVersion": "2026-07-28",
            "io.modelcontextprotocol/clientCapabilities": {},
          },
        },
      }),
    }),
  );

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

  it("logs a tool call over MCP with its tool and User, and its defect at Error with the same", async () => {
    const { id, cookie } = await signUp("katherine@example.com");
    const accessToken = await accessTokenOf(cookie);

    const response = await callTool("todos_list", accessToken);

    expect(response.status).toBe(200);
    const traceId = serverSpanOf("/api/mcp")?.traceId;
    const ofCall = entries.filter((entry) => entry.annotations["trace_id"] === traceId);
    const call = { trace_id: traceId, "user.id": id, "mcp.tool": "todos_list" };
    expect(ofCall.find((entry) => entry.level === "Error")?.annotations).toMatchObject(call);
    expect(
      Cause.pretty(ofCall.find((entry) => entry.level === "Error")?.cause ?? Cause.empty),
    ).toContain(todosCrash);
    expect(
      ofCall.find((entry) => entry.annotations["mcp.result"] !== undefined)?.annotations,
    ).toMatchObject({ ...call, "mcp.result": "tool_error" });
  });

  it("puts the User of the Grant on the span of a tool call", async () => {
    const { id, cookie } = await signUp("dorothy@example.com");

    await callTool("todos_list", await accessTokenOf(cookie));

    const span = spans.findLast(({ name }) => name === "tools/call todos_list");
    expect(span?.attributes.get("user.id")).toBe(id);
    expect(span?.attributes.get("user.role")).toBe("user");
  });
});

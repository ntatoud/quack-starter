import { ConfigProvider, Effect, Layer, Schema } from "effect";
import { HttpClient, HttpClientResponse, HttpRouter, HttpServer } from "effect/http";
import { afterAll, beforeAll, describe, expect, it } from "vite-plus/test";

import { devUsers } from "#/modules/identity/application/identity-seed.ts";
import { IdentitySeed } from "#/modules/identity/index.ts";
import { AuthorizationCodeStoreMemory } from "#/modules/identity/testing/authorization-code-store-memory.ts";
import { GrantStoreMemory } from "#/modules/identity/testing/grant-store-memory.ts";
import { SessionStoreMemory } from "#/modules/identity/testing/session-store-memory.ts";
import { UserRepositoryMemory } from "#/modules/identity/testing/user-repository-memory.ts";
import { TodoRepositoryMemory } from "#/modules/todos/testing/todo-repository-memory.ts";
import { Routes } from "#/server.ts";

const MemoryStorage = Layer.mergeAll(
  UserRepositoryMemory,
  SessionStoreMemory,
  AuthorizationCodeStoreMemory,
  GrantStoreMemory,
  TodoRepositoryMemory,
);

// Another origin than the one of the requests below: the documents must not take theirs from `Host`.
const Config = ConfigProvider.layer(
  ConfigProvider.fromUnknown({ PUBLIC_URL: "https://quack.test" }),
);

/** The URLs Quack fetched, each answered with its document in `documents`, or one that matches none. */
const fetched: Array<string> = [];
const documents = new Map<string, Schema.Json>();

const RecordingHttpClient = Layer.succeed(
  HttpClient.HttpClient,
  HttpClient.make((request) =>
    Effect.sync(() => {
      fetched.push(request.url);

      return HttpClientResponse.fromWeb(request, Response.json(documents.get(request.url) ?? {}));
    }),
  ),
);

const { handler, dispose } = HttpRouter.toWebHandler(
  Routes.pipe(
    Layer.provide([HttpServer.layerServices, MemoryStorage, Config, RecordingHttpClient]),
  ),
);

const get = (path: string) => handler(new Request(new URL(path, "http://api.test")));

const attempt =
  (path: "/api/sign-up" | "/api/sign-in") =>
  (email: string, { from, password = "correct horse battery staple" }: Attempt = {}) => {
    const headers = new Headers({ "content-type": "application/json" });

    if (from !== undefined) headers.set("x-forwarded-for", from);

    return handler(
      new Request(new URL(path, "http://api.test"), {
        method: "POST",
        headers,
        body: JSON.stringify({ email, password }),
      }),
    );
  };

const decodeOpenApi = Schema.decodeUnknownSync(
  Schema.Struct({
    components: Schema.Struct({ securitySchemes: Schema.Record(Schema.String, Schema.Json) }),
    paths: Schema.Record(
      Schema.String,
      Schema.Record(
        Schema.String,
        Schema.Struct({ security: Schema.optional(Schema.Array(Schema.Json)) }),
      ),
    ),
  }),
);

interface Attempt {
  readonly from?: string;
  readonly password?: string;
}

const signUp = attempt("/api/sign-up");

const sessionCookieOf = async (email: string, from: string) =>
  (await signUp(email, { from })).headers.getSetCookie()[0]?.split(";")[0] ?? "";

const signIn = attempt("/api/sign-in");

// A stateless request (MCP 2026-07-28) says what initialize used to: the version it speaks, as its header
// does, and what its AI Client can do.
const statelessMeta = {
  "io.modelcontextprotocol/protocolVersion": "2026-07-28",
  "io.modelcontextprotocol/clientCapabilities": {},
};

const mcpCall = (headers: Record<string, string> = {}) =>
  handler(
    new Request("http://api.test/api/mcp", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json, text/event-stream",
        "mcp-protocol-version": "2026-07-28",
        "mcp-method": "tools/list",
        ...headers,
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "tools/list",
        params: { _meta: statelessMeta },
      }),
    }),
  );

afterAll(dispose);

describe("server routes", () => {
  it("serves the todos of the Current User under /api: the Session of a sign-up opens them", async () => {
    const signedUp = await signUp("barbara@example.com");
    const user = (await signedUp.json()) as { id: string };
    const cookie = signedUp.headers.getSetCookie()[0]?.split(";")[0] ?? "";

    const created = await handler(
      new Request("http://api.test/api/todos", {
        method: "POST",
        headers: { "content-type": "application/json", cookie },
        body: JSON.stringify({ title: "Ship it" }),
      }),
    );

    expect(created.status).toBe(200);
    const todo = await created.json();
    expect(todo).toMatchObject({ title: "Ship it", ownerId: user.id });

    const listed = await handler(new Request("http://api.test/api/todos", { headers: { cookie } }));
    expect(listed.status).toBe(200);
    expect(await listed.json()).toEqual([todo]);
  });

  it("answers 404 TodoNotFound to a user who completes a Todo of another Owner, though they may write Todos", async () => {
    const owner = await sessionCookieOf("dorothy@example.com", "203.0.113.60");
    const other = await sessionCookieOf("radia@example.com", "203.0.113.60");

    const created = await handler(
      new Request("http://api.test/api/todos", {
        method: "POST",
        headers: { "content-type": "application/json", cookie: owner },
        body: JSON.stringify({ title: "Mine" }),
      }),
    );

    const { id } = (await created.json()) as { id: string };

    const response = await handler(
      new Request(`http://api.test/api/todos/${id}/complete`, {
        method: "POST",
        headers: { cookie: other },
      }),
    );

    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({ _tag: "TodoNotFound" });
  });

  it("answers /api/todos with 401 Unauthenticated when the request has no session cookie", async () => {
    const response = await get("/api/todos");

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ _tag: "Unauthenticated" });
  });

  it("clears the session cookie of a request to /api/todos whose cookie opens no Session", async () => {
    const response = await handler(
      new Request("http://api.test/api/todos", {
        headers: { cookie: "session=not-a-session-the-server-opened" },
      }),
    );

    expect(response.status).toBe(401);
    expect(response.headers.getSetCookie()).toEqual([
      expect.stringMatching(/^session=; .*Max-Age=0/),
    ]);
  });

  it("answers /api/users with 403 Forbidden to a user, before it reads the query", async () => {
    const [setCookie] = (
      await signUp("katherine@example.com", { from: "203.0.113.50" })
    ).headers.getSetCookie();

    const cookie = setCookie?.split(";")[0] ?? "";

    const responses = await Promise.all(
      ["", "?pageSize=0"].map((search) =>
        handler(new Request(`http://api.test/api/users${search}`, { headers: { cookie } })),
      ),
    );

    expect(responses.map((response) => response.status)).toEqual([403, 403]);
    expect(await Promise.all(responses.map((response) => response.json()))).toEqual([
      { _tag: "Forbidden", permission: "users:list" },
      { _tag: "Forbidden", permission: "users:list" },
    ]);
  });

  it("serves the health check under /api", async () => {
    expect((await get("/api/health")).status).toBe(204);
  });

  it("serves the OpenAPI document under /api, with the paths as they are served", async () => {
    const response = await get("/api/openapi.json");

    expect(response.status).toBe(200);
    const { paths } = decodeOpenApi(await response.json());
    expect(Object.keys(paths)).toContain("/api/todos");
  });

  it("describes the session cookie as the security scheme of /api/me, of the todos and of the users, and of no public endpoint", async () => {
    const openapi = decodeOpenApi(await (await get("/api/openapi.json")).json());

    expect(openapi.components.securitySchemes).toEqual({
      session: { type: "apiKey", name: "session", in: "cookie" },
    });
    const securityOf = (path: string, method: string) => openapi.paths[path]?.[method]?.security;

    const protectedEndpoints = [
      ["/api/me", "get"],
      ["/api/todos", "get"],
      ["/api/todos", "post"],
      ["/api/todos/{id}/complete", "post"],
      ["/api/todos/{id}", "delete"],
      ["/api/users", "get"],
    ] as const;

    for (const [path, method] of protectedEndpoints) {
      expect(securityOf(path, method)).toEqual([{ session: [] }]);
    }

    const publicEndpoints = [
      ["/api/sign-up", "post"],
      ["/api/sign-out", "post"],
    ] as const;

    for (const [path, method] of publicEndpoints) {
      expect(securityOf(path, method) ?? []).toEqual([]);
    }
  });

  it("signs a visitor up, then answers /api/me to the session cookie it set", async () => {
    const response = await signUp("Ada@Example.com");
    expect(response.status).toBe(200);
    const user = (await response.json()) as { createdAt: string };
    expect(user).toEqual({
      id: expect.any(String),
      email: "ada@example.com",
      role: "user",
      status: "active",
      createdAt: expect.any(String),
      lastSignInAt: user.createdAt,
      onboardedAt: null,
      profile: null,
    });

    const [cookie] = response.headers.getSetCookie();

    const me = await handler(
      new Request("http://api.test/api/me", { headers: { cookie: cookie?.split(";")[0] ?? "" } }),
    );

    expect(me.status).toBe(200);
    expect(await me.json()).toEqual(user);
  });

  it("signs in a request that carries a valid session cookie: opens a new Session, and leaves the other open", async () => {
    const [setAtSignUp] = (await signUp("frances@example.com")).headers.getSetCookie();
    const atSignUp = setAtSignUp?.split(";")[0] ?? "";

    const response = await handler(
      new Request("http://api.test/api/sign-in", {
        method: "POST",
        headers: { "content-type": "application/json", cookie: atSignUp },
        body: JSON.stringify({
          email: "frances@example.com",
          password: "correct horse battery staple",
        }),
      }),
    );

    expect(response.status).toBe(200);
    const atSignIn = response.headers.getSetCookie()[0]?.split(";")[0] ?? "";
    expect(atSignIn).toMatch(/^session=[A-Za-z0-9_-]{43}$/);
    expect(atSignIn).not.toBe(atSignUp);

    const answers = await Promise.all(
      [atSignUp, atSignIn].map((cookie) =>
        handler(new Request("http://api.test/api/me", { headers: { cookie } })),
      ),
    );

    expect(answers.map((me) => me.status)).toEqual([200, 200]);
  });

  it("signs out the Session of the cookie: revokes it, and clears the cookie", async () => {
    const [setCookie] = (await signUp("mary@example.com")).headers.getSetCookie();
    const cookie = setCookie?.split(";")[0] ?? "";
    const me = () => handler(new Request("http://api.test/api/me", { headers: { cookie } }));
    expect((await me()).status).toBe(200);

    const response = await handler(
      new Request("http://api.test/api/sign-out", { method: "POST", headers: { cookie } }),
    );

    expect(response.status).toBe(204);
    expect(response.headers.getSetCookie()).toEqual([
      expect.stringMatching(/^session=; .*Max-Age=0/),
    ]);
    expect((await me()).status).toBe(401);
  });

  it("answers /api/me with 401 Unauthenticated when the request has no session cookie", async () => {
    const response = await get("/api/me");

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ _tag: "Unauthenticated" });
  });

  it("answers a sign-up with 409 EmailAlreadyTaken when a User has this email", async () => {
    await signUp("grace@example.com");

    const response = await signUp("grace@example.com");

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ _tag: "EmailAlreadyTaken" });
  });

  it("answers the 11th sign-up of an address with 429 TooManyAttempts, and tells the addresses apart by X-Forwarded-For", async () => {
    const signedUp = await Promise.all(
      Array.from({ length: 10 }, (_, visitor) =>
        signUp(`visitor-${visitor}@example.com`, { from: "203.0.113.7" }),
      ),
    );

    expect(signedUp.map((response) => response.status)).toEqual(
      Array.from({ length: 10 }, () => 200),
    );

    const refused = await signUp("visitor-10@example.com", { from: "203.0.113.7" });
    const fromAnotherAddress = await signUp("visitor-10@example.com", { from: "203.0.113.8" });

    expect(refused.status).toBe(429);
    const body = (await refused.json()) as { readonly retryAfter: number };
    expect(body).toEqual({ _tag: "TooManyAttempts", retryAfter: expect.any(Number) });
    expect(body.retryAfter).toBeGreaterThan(3500);
    expect(body.retryAfter).toBeLessThanOrEqual(3600);
    expect(refused.headers.getSetCookie()).toEqual([]);
    expect(fromAnotherAddress.status).toBe(200);
  });

  it("answers a sign-in with 429 TooManyAttempts after 5 failures on the email, from any address", async () => {
    await signUp("hedy@example.com", { from: "203.0.113.20" });

    const failed = await Promise.all(
      Array.from({ length: 5 }, (_, failure) =>
        signIn("hedy@example.com", {
          from: `203.0.113.${21 + failure}`,
          password: "not the password of hedy",
        }),
      ),
    );

    expect(failed.map((response) => response.status)).toEqual([401, 401, 401, 401, 401]);

    const response = await signIn("hedy@example.com", { from: "203.0.113.30" });

    expect(response.status).toBe(429);
    const body = (await response.json()) as { readonly retryAfter: number };
    expect(body).toEqual({ _tag: "TooManyAttempts", retryAfter: expect.any(Number) });
    expect(body.retryAfter).toBeGreaterThan(800);
    expect(body.retryAfter).toBeLessThanOrEqual(900);
  });

  it("lets 5 of the sign-ins that fail at once on an email through, and refuses the others", async () => {
    await signUp("joan@example.com", { from: "203.0.113.40" });

    const responses = await Promise.all(
      Array.from({ length: 12 }, () =>
        signIn("joan@example.com", {
          from: "203.0.113.41",
          password: "not the password of joan",
        }),
      ),
    );

    const statuses = responses.map((response) => response.status).toSorted();
    expect(statuses).toEqual([
      ...Array.from({ length: 5 }, () => 401),
      ...Array.from({ length: 7 }, () => 429),
    ]);
  });

  it("serves the docs under /api", async () => {
    const response = await get("/api/docs");

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/html");
  });

  it.each(["/todos", "/health", "/docs", "/openapi.json"])(
    "serves nothing at %s, outside /api",
    async (path) => {
      expect((await get(path)).status).toBe(404);
    },
  );

  it("serves the authorization server metadata at the origin root, built from PUBLIC_URL", async () => {
    const response = await get("/.well-known/oauth-authorization-server");

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      issuer: "https://quack.test",
      authorization_endpoint: "https://quack.test/oauth/authorize",
      token_endpoint: "https://quack.test/api/oauth/token",
      response_types_supported: ["code"],
      grant_types_supported: ["authorization_code", "refresh_token"],
      code_challenge_methods_supported: ["S256"],
      token_endpoint_auth_methods_supported: ["none"],
      client_id_metadata_document_supported: true,
      authorization_response_iss_parameter_supported: true,
      scopes_supported: ["todos:list", "todos:write", "todos:delete"],
    });
  });

  it("serves the protected resource metadata of /api/mcp, built from PUBLIC_URL", async () => {
    const response = await get("/.well-known/oauth-protected-resource/api/mcp");

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      resource: "https://quack.test/api/mcp",
      authorization_servers: ["https://quack.test"],
      scopes_supported: ["todos:list"],
      bearer_methods_supported: ["header"],
    });
  });

  it.each([
    "/.well-known/oauth-authorization-server",
    "/.well-known/oauth-protected-resource/api/mcp",
  ])("lets any origin read %s, without credentials", async (path) => {
    const origin = { origin: "https://ai-client.example" };

    const [read, preflight] = await Promise.all([
      handler(new Request(new URL(path, "http://api.test"), { headers: origin })),
      handler(
        new Request(new URL(path, "http://api.test"), {
          method: "OPTIONS",
          headers: {
            ...origin,
            "access-control-request-method": "GET",
            "access-control-request-headers": "mcp-protocol-version",
          },
        }),
      ),
    ]);

    for (const response of [read, preflight]) {
      expect(response.headers.get("access-control-allow-origin")).toBe("*");
      expect(response.headers.get("access-control-allow-credentials")).toBeNull();
    }

    expect(preflight.status).toBeLessThan(300);
    expect(preflight.headers.get("access-control-allow-headers")).toBe("mcp-protocol-version");
  });

  const resourceMetadata =
    'resource_metadata="https://quack.test/.well-known/oauth-protected-resource/api/mcp"';

  it.each([
    ["no token", {}],
    ["the public origin and no token", { origin: "https://quack.test" }],
  ])(
    "answers /api/mcp with 401 and the challenge naming its resource metadata, to %s",
    async (_, headers) => {
      const response = await mcpCall(headers);

      expect(response.status).toBe(401);
      expect(response.headers.get("www-authenticate")).toBe(`Bearer ${resourceMetadata}`);
    },
  );

  it("answers /api/mcp to a token no Grant holds with 401 invalid_token (RFC 6750 s3)", async () => {
    const response = await mcpCall({ authorization: "Bearer not-a-token-of-quack" });

    expect(response.status).toBe(401);
    expect(response.headers.get("www-authenticate")).toBe(
      `Bearer error="invalid_token", ${resourceMetadata}`,
    );
  });

  it("answers a token request whose body is no form with 415, as OAuth sends only forms", async () => {
    const response = await handler(
      new Request("http://api.test/api/oauth/token", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ grant_type: "authorization_code" }),
      }),
    );

    expect(response.status).toBe(415);
  });

  it("answers /api/mcp with 403 to a request from another origin, before it looks for a token", async () => {
    const response = await mcpCall({
      origin: "https://elsewhere.example",
      authorization: "Bearer not-a-token-of-quack",
    });

    expect(response.status).toBe(403);
    expect(response.headers.get("www-authenticate")).toBeNull();
  });

  it("serves nothing else under /.well-known", async () => {
    expect((await get("/.well-known/oauth-protected-resource")).status).toBe(404);
  });

  it("answers a cross-origin preflight with no CORS header", async () => {
    const response = await handler(
      new Request("http://api.test/api/todos", {
        method: "OPTIONS",
        headers: { origin: "http://localhost:3000", "access-control-request-method": "POST" },
      }),
    );

    expect(response.headers.get("access-control-allow-origin")).toBeNull();
  });
});

describe("server routes of the authorization server", () => {
  const checkAuthorization = (clientId: string, cookie?: string) =>
    handler(
      new Request("http://api.test/api/oauth/authorize/check", {
        method: "POST",
        headers:
          cookie === undefined
            ? { "content-type": "application/json" }
            : { "content-type": "application/json", cookie },
        body: JSON.stringify({ client_id: clientId }),
      }),
    );

  it("answers 401 to a visitor who asks to check an authorization request, and fetches nothing", async () => {
    const clientId = "https://visitor.example.com/client.json";

    const response = await checkAuthorization(clientId);

    expect(response.status).toBe(401);
    expect(fetched).not.toContain(clientId);
  });

  it("fetches the document of the AI Client for a signed-in User", async () => {
    const clientId = "https://signed-in.example.com/client.json";
    const cookie = await sessionCookieOf("check-authorization@example.com", "203.0.113.70");

    const response = await checkAuthorization(clientId, cookie);

    expect(response.status).toBe(400);
    expect(fetched).toContain(clientId);
  });
});

describe("server routes of an AI Client", () => {
  const clientId = "https://claude.example.com/oauth/client.json";
  const redirectUri = "https://claude.example.com/api/mcp/auth_callback";
  const resource = "https://quack.test/api/mcp";

  documents.set(clientId, {
    client_id: clientId,
    client_name: "Claude",
    redirect_uris: [redirectUri],
    token_endpoint_auth_method: "none",
  });

  const authorizationRequest = {
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    // The pair of RFC 7636 appendix B.
    code_challenge: "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM",
    code_challenge_method: "S256",
    resource,
    scope: "todos:list todos:write",
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

  /**
   * The User of `cookie` approves the AI Client on the consent page, with the Permissions it asks for: answers the
   * code it gets back.
   */
  const approvedCode = async (cookie: string, scope = authorizationRequest.scope) => {
    const request = { ...authorizationRequest, scope };
    const check = await post("/api/oauth/authorize/check", request, cookie);

    const { csrfToken, permissions } = (await check.json()) as {
      csrfToken: string;
      permissions: ReadonlyArray<string>;
    };

    const approved = await post(
      "/api/oauth/authorize/approve",
      { ...request, csrfToken, permissions },
      cookie,
    );

    const { redirectTo } = (await approved.json()) as { redirectTo: string };

    return new URL(redirectTo).searchParams.get("code") ?? "";
  };

  const tokenRequest = (params: Readonly<Record<string, string>>, headers = {}) =>
    handler(
      new Request("http://api.test/api/oauth/token", {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded", ...headers },
        body: new URLSearchParams(params),
      }),
    );

  const exchange = (code: string, headers: Record<string, string> = {}) =>
    tokenRequest(
      {
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
        client_id: clientId,
        code_verifier: "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk",
        resource,
      },
      headers,
    );

  const refresh = (refreshToken: string) =>
    tokenRequest({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: clientId,
      resource,
    });

  interface Tokens {
    readonly access_token: string;
    readonly refresh_token: string;
  }

  /** A header given as `undefined` is left out of the request. */
  const callTool = (
    name: string,
    accessToken: string,
    overrides: Readonly<Record<string, string | undefined>> = {},
  ) =>
    handler(
      new Request("http://api.test/api/mcp", {
        method: "POST",
        headers: Object.entries({
          "content-type": "application/json",
          accept: "application/json, text/event-stream",
          "mcp-protocol-version": "2026-07-28",
          "mcp-method": "tools/call",
          "mcp-name": name,
          authorization: `Bearer ${accessToken}`,
          ...overrides,
        }).filter((header): header is [string, string] => header[1] !== undefined),
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "tools/call",
          params: {
            name,
            arguments: {},
            _meta: statelessMeta,
          },
        }),
      }),
    );

  it("an AI Client exchanges the code the User approved, then lists their Todos through MCP", async () => {
    const cookie = await sessionCookieOf("ai-client-flow@example.com", "203.0.113.80");
    await post("/api/todos", { title: "Feed the ducks" }, cookie);

    const token = await exchange(await approvedCode(cookie));

    expect(token.status).toBe(200);
    expect(token.headers.get("cache-control")).toBe("no-store");
    expect(token.headers.get("pragma")).toBe("no-cache");
    const { access_token } = (await token.json()) as { access_token: string };

    const listed = await callTool("todos_list", access_token);

    expect(listed.status).toBe(200);
    expect(await listed.text()).toContain("Feed the ducks");
  });

  it("the User revokes the Grant of an AI Client: its next call gets 401", async () => {
    const cookie = await sessionCookieOf("ai-client-revoked@example.com", "203.0.113.81");
    const { access_token } = (await (await exchange(await approvedCode(cookie))).json()) as Tokens;
    expect((await callTool("todos_list", access_token)).status).toBe(200);

    const listed = await handler(
      new Request("http://api.test/api/grants", { headers: { cookie } }),
    );

    const [grant] = (await listed.json()) as Array<{ id: string }>;

    const revoked = await handler(
      new Request(`http://api.test/api/grants/${grant?.id}`, {
        method: "DELETE",
        headers: { cookie },
      }),
    );

    expect(revoked.status).toBe(204);
    expect((await callTool("todos_list", access_token)).status).toBe(401);
  });

  it("an AI Client refreshes its tokens, until it presents a replaced refresh token: then its Grant is revoked", async () => {
    const cookie = await sessionCookieOf("ai-client-refresh@example.com", "203.0.113.83");
    const first = (await (await exchange(await approvedCode(cookie))).json()) as Tokens;
    expect((await callTool("todos_list", first.access_token)).status).toBe(200);

    const refreshed = await refresh(first.refresh_token);

    expect(refreshed.status).toBe(200);
    expect(refreshed.headers.get("cache-control")).toBe("no-store");
    const second = (await refreshed.json()) as Tokens;
    expect((await callTool("todos_list", second.access_token)).status).toBe(200);

    const reused = await refresh(first.refresh_token);

    expect(reused.status).toBe(400);
    expect(await reused.json()).toMatchObject({ error: "invalid_grant" });
    expect((await callTool("todos_list", second.access_token)).status).toBe(401);
    expect((await callTool("todos_list", first.access_token)).status).toBe(401);
    expect((await refresh(second.refresh_token)).status).toBe(400);
  });

  it("lists the tools a Grant lacks too, so that calling one leads the AI Client to step up", async () => {
    const cookie = await sessionCookieOf("ai-client-list-only@example.com", "203.0.113.82");
    const token = await exchange(await approvedCode(cookie, "todos:list"));
    const { access_token } = (await token.json()) as { access_token: string };

    const listed = await mcpCall({ authorization: `Bearer ${access_token}` });

    expect(listed.status).toBe(200);
    const body = await listed.text();
    expect(body).toContain("todos_list");
    expect(body).toContain("todos_create");
  });

  it("answers a call of a tool whose Permission the Grant lacks with 403 insufficient_scope, naming what to ask for", async () => {
    const cookie = await sessionCookieOf("ai-client-step-up@example.com", "203.0.113.87");
    const token = await exchange(await approvedCode(cookie, "todos:delete todos:list"));
    const { access_token } = (await token.json()) as { access_token: string };

    const response = await callTool("todos_create", access_token);

    expect(response.status).toBe(403);
    expect(response.headers.get("www-authenticate")).toBe(
      'Bearer error="insufficient_scope", scope="todos:list todos:write todos:delete", resource_metadata="https://quack.test/.well-known/oauth-protected-resource/api/mcp"',
    );
  });

  it("decides no step-up for a call with no Mcp-Method header, which the MCP server refuses", async () => {
    const cookie = await sessionCookieOf("ai-client-no-method@example.com", "203.0.113.86");
    const token = await exchange(await approvedCode(cookie, "todos:list"));
    const { access_token } = (await token.json()) as { access_token: string };

    const response = await callTool("todos_create", access_token, { "mcp-method": undefined });

    expect(response.status).toBe(400);
    expect(response.headers.get("www-authenticate")).toBeNull();
  });

  it("leaves a call of a tool Quack does not have to the MCP server, with no step-up", async () => {
    const cookie = await sessionCookieOf("ai-client-unknown-tool@example.com", "203.0.113.85");
    const token = await exchange(await approvedCode(cookie, "todos:list"));
    const { access_token } = (await token.json()) as { access_token: string };

    const response = await callTool("todos_archive", access_token);

    expect(response.status).not.toBe(403);
    expect(response.headers.get("www-authenticate")).toBeNull();
  });

  it("approving the AI Client again sets the Grant's Permissions to those approved now, and revokes its earlier tokens", async () => {
    const cookie = await sessionCookieOf("ai-client-reapproved@example.com", "203.0.113.84");

    const earlier = (await (
      await exchange(await approvedCode(cookie, "todos:list todos:write"))
    ).json()) as Tokens;

    const second = await exchange(await approvedCode(cookie, "todos:list"));
    const { access_token: later } = (await second.json()) as Tokens;

    expect((await mcpCall({ authorization: `Bearer ${earlier.access_token}` })).status).toBe(401);
    expect(await (await refresh(earlier.refresh_token)).json()).toMatchObject({
      error: "invalid_grant",
    });
    expect((await callTool("todos_list", later)).status).toBe(200);
    expect((await callTool("todos_create", later)).status).toBe(403);
  });

  it("answers the token endpoint to any origin, without credentials", async () => {
    const origin = { origin: "https://claude.example.com" };

    const [refused, preflight] = await Promise.all([
      exchange("not-a-code-of-quack", origin),
      handler(
        new Request("http://api.test/api/oauth/token", {
          method: "OPTIONS",
          headers: {
            ...origin,
            "access-control-request-method": "POST",
            "access-control-request-headers": "content-type",
          },
        }),
      ),
    ]);

    expect(refused.status).toBe(400);
    expect(await refused.json()).toMatchObject({ error: "invalid_grant" });
    expect(preflight.status).toBeLessThan(300);

    for (const response of [refused, preflight]) {
      expect(response.headers.get("access-control-allow-origin")).toBe("*");
      expect(response.headers.get("access-control-allow-credentials")).toBeNull();
    }
  });

  it("answers the 21st failed token request of an address with 429, Retry-After, and an OAuth error, and tells the addresses apart by X-Forwarded-For", async () => {
    const from = { "x-forwarded-for": "203.0.113.90" };

    const failed = await Promise.all(
      Array.from({ length: 20 }, () => exchange("not-a-code-of-quack", from)),
    );

    expect(failed.map((response) => response.status)).toEqual(
      Array.from({ length: 20 }, () => 400),
    );

    const refused = await exchange("not-a-code-of-quack", from);

    const fromAnotherAddress = await exchange("not-a-code-of-quack", {
      "x-forwarded-for": "203.0.113.91",
    });

    expect(refused.status).toBe(429);
    const retryAfter = Number(refused.headers.get("retry-after"));
    expect(retryAfter).toBeGreaterThan(800);
    expect(retryAfter).toBeLessThanOrEqual(900);
    expect(await refused.json()).toEqual({
      error: "invalid_request",
      error_description: `Too many attempts, retry in ${retryAfter} seconds`,
    });
    expect(refused.headers.get("cache-control")).toBe("no-store");
    expect(refused.headers.get("access-control-allow-origin")).toBe("*");
    expect(refused.headers.get("access-control-expose-headers")).toBe("retry-after");
    expect(fromAnotherAddress.status).toBe(400);
  });

  it("refuses the access token of a Grant anywhere under /api but /api/mcp", async () => {
    const cookie = await sessionCookieOf("ai-client-bearer@example.com", "203.0.113.81");
    const token = await exchange(await approvedCode(cookie));
    const { access_token } = (await token.json()) as { access_token: string };

    const response = await handler(
      new Request("http://api.test/api/todos", {
        headers: { authorization: `Bearer ${access_token}` },
      }),
    );

    expect(response.status).toBe(401);
  });
});

const makeSeeded = () =>
  HttpRouter.toWebHandler(
    Layer.mergeAll(Routes, IdentitySeed).pipe(
      Layer.provide([HttpServer.layerServices, MemoryStorage, Config, RecordingHttpClient]),
    ),
  );

describe("server routes, with the dev Users seeded", () => {
  let seeded: ReturnType<typeof makeSeeded>;
  let cookie = "";

  beforeAll(async () => {
    seeded = makeSeeded();

    const signedIn = await seeded.handler(
      new Request("http://api.test/api/sign-in", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: "admin@quack.dev", password: "quack-password" }),
      }),
    );

    cookie = signedIn.headers.getSetCookie()[0]?.split(";")[0] ?? "";
  });

  afterAll(() => seeded.dispose());

  const usersAt = (search: string) =>
    seeded.handler(new Request(`http://api.test/api/users${search}`, { headers: { cookie } }));

  it("answers /api/users to an Admin, sorted as the query asks, and with 400 when the query is out of bounds", async () => {
    const firstPage = await usersAt("");
    expect(firstPage.status).toBe(200);
    expect(await firstPage.json()).toMatchObject({ total: devUsers().length });

    const outOfBounds = await Promise.all(
      ["?pageSize=0", "?pageSize=101", "?pageSize=2.5", "?page=0", "?orderBy=id", "?dir=up"].map(
        usersAt,
      ),
    );

    expect(outOfBounds.map((response) => response.status)).toEqual([400, 400, 400, 400, 400, 400]);
    const byRoleDesc = await usersAt("?orderBy=role&dir=desc&pageSize=1");
    expect(await byRoleDesc.json()).toMatchObject({ items: [{ role: "user" }] });

    const suspended = (await (await usersAt("?status=suspended&pageSize=100")).json()) as {
      total: number;
      items: Array<{ status: string }>;
    };

    expect(suspended.total).toBeGreaterThan(0);
    expect(new Set(suspended.items.map(({ status }) => status))).toEqual(new Set(["suspended"]));
    expect((await usersAt("?status=deleted")).status).toBe(400);
  });
});

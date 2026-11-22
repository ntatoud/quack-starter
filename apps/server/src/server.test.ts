import { Layer } from "effect";
import { HttpRouter, HttpServer } from "effect/http";
import { afterAll, beforeAll, describe, expect, it } from "vite-plus/test";

import { devUsers } from "#/modules/identity/application/identity-seed.ts";
import { IdentitySeed } from "#/modules/identity/index.ts";
import { SessionStoreMemory } from "#/modules/identity/testing/session-store-memory.ts";
import { UserRepositoryMemory } from "#/modules/identity/testing/user-repository-memory.ts";
import { TodoRepositoryMemory } from "#/modules/todos/testing/todo-repository-memory.ts";
import { Routes } from "#/server.ts";

const MemoryStorage = Layer.mergeAll(
  UserRepositoryMemory,
  SessionStoreMemory,
  TodoRepositoryMemory,
);

const { handler, dispose } = HttpRouter.toWebHandler(
  Routes.pipe(Layer.provide([HttpServer.layerServices, MemoryStorage])),
);

const get = (path: string) => handler(new Request(new URL(path, "http://api.test")));

const attempt =
  (path: "/api/sign-up" | "/api/sign-in") =>
  (email: string, { from, password = "correct horse battery staple" }: Attempt = {}) =>
    handler(
      new Request(new URL(path, "http://api.test"), {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(from === undefined ? {} : { "x-forwarded-for": from }),
        },
        body: JSON.stringify({ email, password }),
      }),
    );

interface Attempt {
  readonly from?: string;
  readonly password?: string;
}

const signUp = attempt("/api/sign-up");
const signIn = attempt("/api/sign-in");

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
    const cookieOf = async (email: string) =>
      (await signUp(email, { from: "203.0.113.60" })).headers.getSetCookie()[0]?.split(";")[0] ??
      "";
    const owner = await cookieOf("dorothy@example.com");
    const other = await cookieOf("hedy@example.com");
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
    const { paths } = (await response.json()) as { paths: Record<string, unknown> };
    expect(Object.keys(paths)).toContain("/api/todos");
  });

  it("describes the session cookie as the security scheme of /api/me, of the todos and of the users, and of no public endpoint", async () => {
    const openapi = (await (await get("/api/openapi.json")).json()) as {
      components: { securitySchemes: Record<string, unknown> };
      paths: Record<string, Record<string, { security?: ReadonlyArray<Record<string, unknown>> }>>;
    };

    expect(openapi.components.securitySchemes).toEqual({
      session: { type: "apiKey", name: "session", in: "cookie" },
    });
    expect(openapi.paths["/api/me"]?.["get"]?.security).toEqual([{ session: [] }]);
    expect(openapi.paths["/api/sign-up"]?.["post"]?.security ?? []).toEqual([]);
    expect(openapi.paths["/api/sign-out"]?.["post"]?.security ?? []).toEqual([]);
    expect(openapi.paths["/api/todos"]?.["get"]?.security).toEqual([{ session: [] }]);
    expect(openapi.paths["/api/todos"]?.["post"]?.security).toEqual([{ session: [] }]);
    expect(openapi.paths["/api/todos/{id}/complete"]?.["post"]?.security).toEqual([
      { session: [] },
    ]);
    expect(openapi.paths["/api/todos/{id}"]?.["delete"]?.security).toEqual([{ session: [] }]);
    expect(openapi.paths["/api/users"]?.["get"]?.security).toEqual([{ session: [] }]);
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

const makeSeeded = () =>
  HttpRouter.toWebHandler(
    Layer.mergeAll(Routes, IdentitySeed).pipe(
      Layer.provide([HttpServer.layerServices, MemoryStorage]),
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

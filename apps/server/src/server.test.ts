import { Layer } from "effect";
import { HttpRouter, HttpServer } from "effect/http";
import { afterAll, describe, expect, it } from "vite-plus/test";

import { Routes } from "#/server.ts";

// The routes as the HTTP server serves them, called without a port.
const { handler, dispose } = HttpRouter.toWebHandler(
  Routes.pipe(Layer.provide(HttpServer.layerServices)),
);

const get = (path: string) => handler(new Request(new URL(path, "http://api.test")));

const signUp = (email: string) =>
  handler(
    new Request("http://api.test/api/sign-up", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password: "correct horse battery staple" }),
    }),
  );

afterAll(dispose);

describe("server routes", () => {
  it("serves the todos under /api", async () => {
    const response = await get("/api/todos");

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual([]);
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

  it("signs a visitor up, and answers with their public User", async () => {
    const response = await signUp("Ada@Example.com");

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ id: expect.any(String), email: "ada@example.com" });
  });

  it("answers a sign-up with 409 EmailAlreadyTaken when a User has this email", async () => {
    await signUp("grace@example.com");

    const response = await signUp("grace@example.com");

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ _tag: "EmailAlreadyTaken" });
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

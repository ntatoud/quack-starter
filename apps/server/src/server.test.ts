import { Layer } from "effect";
import { HttpRouter, HttpServer } from "effect/http";
import { afterAll, describe, expect, it } from "vite-plus/test";

import { Routes } from "#/server.ts";

// The routes as the HTTP server serves them, called without a port.
const { handler, dispose } = HttpRouter.toWebHandler(
  Routes.pipe(Layer.provide(HttpServer.layerServices)),
);

const get = (path: string) => handler(new Request(new URL(path, "http://api.test")));

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

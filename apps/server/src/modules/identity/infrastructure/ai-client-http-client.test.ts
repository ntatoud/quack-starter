import * as Http from "node:http";
import type { AddressInfo } from "node:net";

import { ConfigProvider, Effect, Exit, Layer } from "effect";
import { HttpClient } from "effect/http";
import { afterAll, beforeAll, describe, expect, it } from "vite-plus/test";

import { AiClientHttpClient } from "#/modules/identity/infrastructure/ai-client-http-client.ts";

/** A server on this machine, as one Quack must not reach unless told to: `/redirect` sends elsewhere. */
const local = Http.createServer((request, response) => {
  if (request.url === "/redirect") {
    response.writeHead(302, { location: "/document" }).end();
  } else {
    response.writeHead(200, { "content-type": "application/json" }).end("{}");
  }
});

let port = 0;

beforeAll(async () => {
  await new Promise<void>((resolve) => local.listen(0, "127.0.0.1", resolve));
  port = (local.address() as AddressInfo).port;
});

afterAll(() => new Promise<void>((resolve) => local.close(() => resolve())));

const get = (url: string, allowLoopback: boolean) =>
  HttpClient.get(url).pipe(
    Effect.provide(
      AiClientHttpClient.pipe(
        Layer.provide(
          ConfigProvider.layer(
            ConfigProvider.fromUnknown({ AI_CLIENT_LOOPBACK_HTTP: String(allowLoopback) }),
          ),
        ),
      ),
    ),
    Effect.exit,
    Effect.runPromise,
  );

const refusalOf = async (url: string, allowLoopback = false) => {
  const exit = await get(url, allowLoopback);

  return Exit.isFailure(exit) ? String(exit.cause) : "answered";
};

describe("AiClientHttpClient", () => {
  it("refuses a host that resolves to this machine", async () => {
    expect(await refusalOf(`http://localhost:${port}/document`)).toMatch(/not a public address/);
  });

  it("refuses private, loopback, and special-use addresses written in the URL, without connecting", async () => {
    const addresses = [
      `127.0.0.1:${port}`,
      "10.0.0.1",
      "172.16.0.1",
      "192.168.1.1",
      "169.254.169.254",
      "100.64.0.1",
      "0.0.0.0",
      "[::1]",
      "[::ffff:127.0.0.1]",
      "[fd00::1]",
      "[fe80::1]",
    ];

    for (const address of addresses) {
      expect(await refusalOf(`https://${address}/document`), address).toMatch(
        /not a public address/,
      );
    }
  });

  it("reaches this machine when loopback AI Clients are allowed, but still no private address", async () => {
    const exit = await get(`http://localhost:${port}/document`, true);

    expect(Exit.isSuccess(exit) && exit.value.status).toBe(200);
    expect(await refusalOf("https://10.0.0.1/document", true)).toMatch(/not a public address/);
  });

  it("follows no redirect", async () => {
    const exit = await get(`http://127.0.0.1:${port}/redirect`, true);

    expect(Exit.isSuccess(exit) && exit.value.status).toBe(302);
  });
});

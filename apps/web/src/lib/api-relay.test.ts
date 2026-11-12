import { createServer } from "node:http";
import type { IncomingHttpHeaders, ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import { gzipSync } from "node:zlib";

import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vite-plus/test";

import { ApiRelayHandler } from "#/lib/api-relay.ts";

interface Received {
  readonly method: string | undefined;
  readonly url: string | undefined;
  readonly headers: IncomingHttpHeaders;
  readonly body: string;
}

// A fake upstream: a real HTTP server that records what it receives and answers as each test says.
let received: Array<Received>;
let answer: (response: ServerResponse) => void;

const upstream = createServer((request, response) => {
  const chunks: Array<Buffer> = [];
  request.on("data", (chunk: Buffer) => chunks.push(chunk));
  request.on("end", () => {
    received.push({
      method: request.method,
      url: request.url,
      headers: request.headers,
      body: Buffer.concat(chunks).toString(),
    });
    answer(response);
  });
});

let apiUrl: URL;

beforeAll(async () => {
  await new Promise<void>((resolve) => upstream.listen(0, "127.0.0.1", resolve));
  apiUrl = new URL(`http://127.0.0.1:${(upstream.address() as AddressInfo).port}`);
});

afterAll(() => {
  upstream.close();
});

beforeEach(() => {
  received = [];
  answer = (response) => response.end("ok");
});

const handle = (
  url: URL,
  path: string,
  init: RequestInit | undefined,
  clientIp: string | undefined,
) =>
  new ApiRelayHandler({ url }).handle(new Request(new URL(path, "http://web.test"), init), {
    prefix: "/api",
    context: { clientIp },
  });

/** Relays a request as the web app receives it, on its own origin. */
const relay = async (
  path: string,
  init?: RequestInit,
  clientIp: string | undefined = "203.0.113.7",
) => {
  const { response } = await handle(apiUrl, path, init, clientIp);
  if (response === undefined) throw new Error(`${path} was not relayed`);
  return response;
};

describe("ApiRelayHandler", () => {
  it("sends the path and the query to the upstream as they came", async () => {
    await relay("/api/todos/42?filter=open&sort=a%20b");

    expect(received).toHaveLength(1);
    expect(received[0]?.method).toBe("GET");
    expect(received[0]?.url).toBe("/api/todos/42?filter=open&sort=a%20b");
  });

  it("sends the method, the body, and its content type", async () => {
    await relay("/api/todos", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title: "Ship it" }),
    });

    expect(received[0]?.method).toBe("POST");
    expect(received[0]?.headers["content-type"]).toBe("application/json");
    expect(received[0]?.body).toBe('{"title":"Ship it"}');
  });

  it("sends a body whose client asked for 100 Continue first", async () => {
    // `curl` sends `Expect: 100-continue` with a large body, and `fetch` refuses to send that header.
    const response = await relay("/api/todos", {
      method: "POST",
      headers: { "content-type": "application/json", expect: "100-continue" },
      body: '{"title":"Ship it"}',
    });

    expect(response.status).toBe(200);
    expect(received[0]?.body).toBe('{"title":"Ship it"}');
    expect(received[0]?.headers.expect).toBeUndefined();
  });

  it("sends the Cookie header", async () => {
    await relay("/api/todos", { headers: { cookie: "session=abc; theme=dark" } });

    expect(received[0]?.headers.cookie).toBe("session=abc; theme=dark");
  });

  it("returns every Set-Cookie header of the upstream, each as its own header", async () => {
    answer = (response) => {
      response.setHeader("set-cookie", [
        "session=abc; Path=/; HttpOnly; SameSite=Lax",
        "theme=dark; Path=/",
      ]);
      response.end();
    };

    const response = await relay("/api/sign-in", { method: "POST" });

    expect(response.headers.getSetCookie()).toEqual([
      "session=abc; Path=/; HttpOnly; SameSite=Lax",
      "theme=dark; Path=/",
    ]);
  });

  it("replaces the client's X-Forwarded-For with the address it sees", async () => {
    await relay("/api/todos", { headers: { "x-forwarded-for": "1.2.3.4, 5.6.7.8" } });

    expect(received[0]?.headers["x-forwarded-for"]).toBe("203.0.113.7");
  });

  it("sets X-Forwarded-For when the client sent none", async () => {
    await relay("/api/todos");

    expect(received[0]?.headers["x-forwarded-for"]).toBe("203.0.113.7");
  });

  it("drops the client's X-Forwarded-For when it sees no address", async () => {
    await handle(apiUrl, "/api/todos", { headers: { "x-forwarded-for": "1.2.3.4" } }, undefined);

    expect(received[0]?.headers["x-forwarded-for"]).toBeUndefined();
  });

  it("returns the status, the headers, and the body of the upstream", async () => {
    answer = (response) => {
      response.writeHead(404, { "content-type": "application/json" });
      response.end('{"_tag":"TodoNotFound"}');
    };

    const response = await relay("/api/todos/missing/complete", { method: "POST" });

    expect(response.status).toBe(404);
    expect(response.headers.get("content-type")).toBe("application/json");
    expect(await response.json()).toEqual({ _tag: "TodoNotFound" });
  });

  it("keeps the headers of its connection to the upstream to itself", async () => {
    const response = await relay("/api/todos");

    expect(response.headers.get("connection")).toBeNull();
    expect(response.headers.get("keep-alive")).toBeNull();
  });

  it("returns a response with no body as it is", async () => {
    answer = (response) => {
      response.writeHead(204);
      response.end();
    };

    const response = await relay("/api/todos/42", { method: "DELETE" });

    expect(response.status).toBe(204);
    expect(await response.text()).toBe("");
  });

  it("returns the length of a body it did not decode", async () => {
    answer = (response) => {
      response.writeHead(200, { "content-type": "application/json", "content-length": 19 });
      response.end();
    };

    const response = await relay("/api/todos", { method: "HEAD" });

    expect(response.headers.get("content-length")).toBe("19");
  });

  it("returns a redirect to the client and does not follow it", async () => {
    answer = (response) => {
      response.writeHead(302, { location: "/api/elsewhere" });
      response.end();
    };

    const response = await relay("/api/todos");

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe("/api/elsewhere");
    expect(received).toHaveLength(1);
  });

  it("returns a compressed body decoded, without the headers of its encoding", async () => {
    const body = gzipSync('{"compressed":true}');
    answer = (response) => {
      response.writeHead(200, {
        "content-type": "application/json",
        "content-encoding": "gzip",
        "content-length": body.length,
      });
      response.end(body);
    };

    const response = await relay("/api/todos", { headers: { "accept-encoding": "gzip" } });

    expect(response.headers.get("content-encoding")).toBeNull();
    expect(response.headers.get("content-length")).toBeNull();
    expect(await response.json()).toEqual({ compressed: true });
  });

  it("answers 502 when the upstream cannot be reached", async () => {
    // Port 1 is reserved: nothing listens there.
    const { response } = await handle(
      new URL("http://127.0.0.1:1"),
      "/api/todos",
      undefined,
      "203.0.113.7",
    );

    expect(response?.status).toBe(502);
  });

  it.each(["/", "/todos", "/apionly"])("does not relay %s, outside its prefix", async (path) => {
    const result = await handle(apiUrl, path, undefined, "203.0.113.7");

    expect(result).toEqual({ matched: false, response: undefined });
    expect(received).toHaveLength(0);
  });
});

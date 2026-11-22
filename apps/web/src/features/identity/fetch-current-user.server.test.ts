import { createServer } from "node:http";
import type { IncomingHttpHeaders, ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";

import { User } from "@quack/contracts/identity/user";
import { Schema } from "effect";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vite-plus/test";

import { fetchCurrentUser } from "#/features/identity/fetch-current-user.server.ts";

let received: Array<{ readonly url: string | undefined; readonly headers: IncomingHttpHeaders }>;
let answer: (response: ServerResponse) => void;

const upstream = createServer((request, response) => {
  received.push({ url: request.url, headers: request.headers });
  answer(response);
});

let apiUrl: URL;

beforeAll(async () => {
  await new Promise<void>((resolve) => upstream.listen(0, "127.0.0.1", resolve));
  apiUrl = new URL(`http://127.0.0.1:${(upstream.address() as AddressInfo).port}`);
});

afterAll(() => {
  upstream.close();
});

const json =
  (
    status: number,
    body: Readonly<Record<string, string | null>>,
    headers: Record<string, string | Array<string>> = {},
  ) =>
  (response: ServerResponse) => {
    response.writeHead(status, { "content-type": "application/json", ...headers });
    response.end(JSON.stringify(body));
  };

const ada = {
  id: "1",
  email: "ada@example.com",
  role: "user",
  status: "active",
  createdAt: "2026-01-01T00:00:00.000Z",
  lastSignInAt: null,
  onboardedAt: "2026-01-01T00:00:00.000Z",
  profile: null,
};

beforeEach(() => {
  received = [];
  answer = json(200, ada);
});

describe("fetchCurrentUser", () => {
  it("asks the API's me with the cookie of the request, and answers with the User", async () => {
    const { user, setCookie } = await fetchCurrentUser({
      apiUrl,
      cookie: "session=abc; theme=dark",
      clientIp: "203.0.113.7",
    });

    expect(user === null ? null : Schema.encodeSync(User)(user)).toEqual(ada);
    expect(setCookie).toEqual([]);
    expect(received).toHaveLength(1);
    expect(received[0]?.url).toBe("/api/me");
    expect(received[0]?.headers.cookie).toBe("session=abc; theme=dark");
    expect(received[0]?.headers["x-forwarded-for"]).toBe("203.0.113.7");
  });

  it("sends no cookie and names no client when the request has none", async () => {
    answer = json(401, { _tag: "Unauthenticated" });

    await fetchCurrentUser({ apiUrl, cookie: undefined, clientIp: undefined });

    expect(received[0]?.headers.cookie).toBeUndefined();
    expect(received[0]?.headers["x-forwarded-for"]).toBeUndefined();
  });

  it("answers null when the API says Unauthenticated", async () => {
    answer = json(401, { _tag: "Unauthenticated" });

    const { user } = await fetchCurrentUser({
      apiUrl,
      cookie: "session=unknown",
      clientIp: undefined,
    });

    expect(user).toBeNull();
  });

  it("hands over the session cookie the API extends, with its attributes", async () => {
    answer = json(200, ada, {
      "set-cookie": "session=abc; Max-Age=2592000; Path=/; HttpOnly; Secure; SameSite=Lax",
    });

    const { setCookie } = await fetchCurrentUser({
      apiUrl,
      cookie: "session=abc",
      clientIp: undefined,
    });

    expect(setCookie).toEqual([
      "session=abc; Max-Age=2592000; Path=/; HttpOnly; Secure; SameSite=Lax",
    ]);
  });

  it("hands over the session cookie the API clears with Unauthenticated", async () => {
    answer = json(
      401,
      { _tag: "Unauthenticated" },
      { "set-cookie": "session=; Max-Age=0; Path=/; HttpOnly; Secure; SameSite=Lax" },
    );

    const { user, setCookie } = await fetchCurrentUser({
      apiUrl,
      cookie: "session=expired",
      clientIp: undefined,
    });

    expect(user).toBeNull();
    expect(setCookie).toEqual(["session=; Max-Age=0; Path=/; HttpOnly; Secure; SameSite=Lax"]);
  });

  it("rejects when the API fails, so a failure is not taken for a visitor without a Session", async () => {
    answer = json(500, {});

    await expect(
      fetchCurrentUser({ apiUrl, cookie: "session=abc", clientIp: undefined }),
    ).rejects.toThrow();
  });
});

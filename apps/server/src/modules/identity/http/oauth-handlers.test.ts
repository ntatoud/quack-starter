import { assert, layer } from "@effect/vitest";
import { Api } from "@quack/contracts/api";
import { Authentication } from "@quack/contracts/identity/authentication";
import { Email, User, UserId } from "@quack/contracts/identity/user";
import type { AuthorizationRequestParams } from "@quack/contracts/oauth/authorization-request";
import type { AuthorizationErrorCode } from "@quack/contracts/oauth/oauth-errors";
import { ConfigProvider, DateTime, Effect, Fiber, Layer, Schema } from "effect";
import { HttpClient, HttpClientRequest, HttpClientResponse, HttpServer } from "effect/http";
import { HttpApiMiddleware, HttpApiTest } from "effect/http-api";
import { TestClock } from "effect/testing";

import { OAuthModule } from "#/modules/identity/index.ts";
import { authenticationByUserId } from "#/modules/identity/testing/authentication-by-user-id.ts";

const ada = new User({
  id: UserId.make("ada"),
  email: Email.make("ada@example.com"),
  role: "user",
  status: "active",
  createdAt: DateTime.makeUnsafe("2026-01-01T00:00:00Z"),
  lastSignInAt: null,
  onboardedAt: null,
  profile: null,
});

const publicOrigin = "https://quack.test";
const resource = `${publicOrigin}/api/mcp`;

/** What the AI Clients' servers answer, by URL. Each test serves its own URLs: tests run shuffled. */
const served = new Map<string, () => Response>();
const fetched: Array<HttpClientRequest.HttpClientRequest> = [];
const fetchesOf = (url: string) => fetched.filter((request) => request.url === url).length;

const serve = (url: string, answer: () => Response) => served.set(url, answer);

// A field set to undefined is left out of the JSON: how a test serves a document without it.
type DocumentFields = Readonly<Record<string, Schema.Json | undefined>>;

const json = (body: DocumentFields, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), {
    headers: { "content-type": "application/json", ...headers },
  });

const documentOf = (clientId: string, fields: DocumentFields = {}) => ({
  client_id: clientId,
  client_name: "Claude",
  redirect_uris: ["https://claude.ai/api/mcp/auth_callback"],
  token_endpoint_auth_method: "none",
  ...fields,
});

/** Serves the document of a new AI Client, unique to the test, and answers its URL. */
let clients = 0;

const anAiClient = (fields: DocumentFields = {}, headers: Record<string, string> = {}) => {
  clients += 1;
  const clientId = `https://ai-${clients}.example.com/oauth/client.json`;
  serve(clientId, () => json(documentOf(clientId, fields), headers));

  return clientId;
};

const StubHttpClient = Layer.succeed(
  HttpClient.HttpClient,
  HttpClient.make((request) =>
    Effect.suspend(() => {
      fetched.push(request);
      const answer = served.get(request.url);

      return answer === undefined
        ? Effect.never
        : Effect.succeed(HttpClientResponse.fromWeb(request, answer()));
    }),
  ),
);

const requestOf = (clientId: string, params: AuthorizationRequestParams = {}) => ({
  client_id: clientId,
  redirect_uri: "https://claude.ai/api/mcp/auth_callback",
  response_type: "code",
  code_challenge: "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM",
  code_challenge_method: "S256",
  resource,
  scope: "todos:list todos:write",
  ...params,
});

const client = HttpApiTest.groups(Api, ["oauth"]).pipe(
  Effect.provide(
    HttpApiMiddleware.layerClient(Authentication, ({ next, request }) =>
      next(HttpClientRequest.setHeader(request, "cookie", `session=${ada.id}`)),
    ),
  ),
);

const check = (payload: AuthorizationRequestParams) =>
  Effect.flatMap(client, (api) => api.oauth.checkAuthorization({ payload }));

const refusal = (payload: AuthorizationRequestParams) =>
  check(payload).pipe(
    Effect.flip,
    Effect.map((error) => {
      assert.strictEqual(error._tag, "AuthorizationRequestRefused");

      return error._tag === "AuthorizationRequestRefused"
        ? { error: error.error, redirect_uri: error.redirect_uri }
        : undefined;
    }),
  );

const withConfig = (env: Record<string, string>) =>
  Layer.mergeAll(
    OAuthModule.pipe(
      Layer.provide(StubHttpClient),
      Layer.provideMerge(authenticationByUserId([ada])),
      Layer.provide(
        ConfigProvider.layer(ConfigProvider.fromUnknown({ PUBLIC_URL: publicOrigin, ...env })),
      ),
    ),
    HttpServer.layerServices,
  );

const redirectUri = "https://claude.ai/api/mcp/auth_callback";

layer(withConfig({}))("OAuthApi checkAuthorization", (it) => {
  it.effect("answers with what the consent page shows of a valid request", () =>
    Effect.gen(function* () {
      const clientId = anAiClient();

      const request = yield* check(requestOf(clientId));

      assert.deepStrictEqual(request.aiClient, {
        id: clientId,
        host: new URL(clientId).hostname,
        name: "Claude",
      });
      assert.strictEqual(request.redirectHost, "claude.ai");
      assert.isFalse(request.loopbackOnly);
      assert.deepStrictEqual(request.permissions, ["todos:list", "todos:write"]);
      assert.isNull(request.grantedPermissions);
    }),
  );

  it.effect("asks for the document as JSON", () =>
    Effect.gen(function* () {
      const clientId = anAiClient();

      yield* check(requestOf(clientId));

      const request = fetched.find(({ url }) => url === clientId);
      assert.strictEqual(request?.method, "GET");
      assert.strictEqual(request?.headers["accept"], "application/json");
    }),
  );

  it.effect(
    "refuses a client_id that is no https URL with a path, before it fetches anything",
    () =>
      Effect.gen(function* () {
        const refused = [
          "not a url",
          "http://ai.example.com/client.json",
          "http://localhost:6274/client.json",
          "https://user:secret@ai.example.com/client.json",
          "https://ai.example.com/client.json#fragment",
          "https://ai.example.com/",
          `${publicOrigin}/client.json`,
        ];

        for (const clientId of refused) {
          serve(clientId, () => json(documentOf(clientId)));
          assert.deepStrictEqual(yield* refusal(requestOf(clientId)), {
            error: "invalid_client",
            redirect_uri: undefined,
          });
          assert.strictEqual(fetchesOf(clientId), 0, clientId);
        }

        const { client_id: _, ...withoutClientId } = requestOf("");
        assert.strictEqual((yield* refusal(withoutClientId))?.error, "invalid_request");
      }),
  );

  it.effect(
    "refuses an AI Client whose document cannot be fetched, and fetches it again next time",
    () =>
      Effect.gen(function* () {
        const failing = {
          notFound: () => new Response("", { status: 404 }),
          redirect: () =>
            new Response("", { status: 302, headers: { location: "https://ai.example.com/" } }),
          tooLarge: () =>
            json(
              { ...documentOf("x"), padding: "x".repeat(5 * 1024) },
              { "cache-control": "max-age=60" },
            ),
          tooLargeUndeclared: () =>
            new Response(
              new ReadableStream({
                start(controller) {
                  controller.enqueue(new TextEncoder().encode("x".repeat(6 * 1024)));
                  controller.close();
                },
              }),
            ),
          notJson: () =>
            new Response("<html></html>", { headers: { "cache-control": "max-age=60" } }),
        };

        for (const [name, answer] of Object.entries(failing)) {
          clients += 1;
          const clientId = `https://ai-${clients}.example.com/${name}.json`;
          serve(clientId, answer);

          assert.deepStrictEqual(yield* refusal(requestOf(clientId)), {
            error: "invalid_client",
            redirect_uri: undefined,
          });
          yield* refusal(requestOf(clientId));
          assert.strictEqual(fetchesOf(clientId), 2, name);
        }
      }),
  );

  it.effect("refuses an AI Client whose server does not answer in time", () =>
    Effect.gen(function* () {
      const clientId = "https://silent.example.com/client.json";

      const fiber = yield* Effect.forkChild(refusal(requestOf(clientId)));
      yield* TestClock.adjust("5 seconds");

      assert.strictEqual((yield* Fiber.join(fiber))?.error, "invalid_client");
    }),
  );

  it.effect(
    "refuses a document that is not the AI Client's, or that an AI Client with a secret serves",
    () =>
      Effect.gen(function* () {
        const invalid = [
          { client_id: "https://elsewhere.example.com/client.json" },
          { client_name: undefined },
          { client_name: "" },
          { redirect_uris: undefined },
          { redirect_uris: [] },
          { token_endpoint_auth_method: "client_secret_basic" },
          { token_endpoint_auth_method: "client_secret_post" },
        ];

        for (const fields of invalid) {
          const clientId = anAiClient(fields);
          assert.deepStrictEqual(
            yield* refusal(requestOf(clientId)),
            { error: "invalid_client", redirect_uri: undefined },
            JSON.stringify(fields),
          );
        }
      }),
  );

  it.effect(
    "refuses a redirect_uri the document does not list, and does not send the error to it",
    () =>
      Effect.gen(function* () {
        const clientId = anAiClient();

        for (const redirect_uri of ["https://evil.example.com/callback", `${redirectUri}/more`]) {
          assert.deepStrictEqual(yield* refusal(requestOf(clientId, { redirect_uri })), {
            error: "invalid_request",
            redirect_uri: undefined,
          });
        }
      }),
  );

  it.effect(
    "matches a loopback redirect_uri on any port, and warns when every redirect is loopback",
    () =>
      Effect.gen(function* () {
        const clientId = anAiClient({
          redirect_uris: ["http://localhost/callback", "http://127.0.0.1:3118/callback"],
        });

        const onLocalhost = yield* check(
          requestOf(clientId, { redirect_uri: "http://localhost:51234/callback" }),
        );

        const on127 = yield* check(
          requestOf(clientId, { redirect_uri: "http://127.0.0.1:4000/callback" }),
        );

        const otherPath = yield* refusal(
          requestOf(clientId, { redirect_uri: "http://localhost:51234/other" }),
        );

        assert.strictEqual(onLocalhost.redirectHost, "localhost");
        assert.isTrue(onLocalhost.loopbackOnly);
        assert.strictEqual(on127.redirectHost, "127.0.0.1");
        assert.strictEqual(otherPath?.error, "invalid_request");
      }),
  );

  it.effect(
    "refuses a request with no S256 code challenge, another resource, or another response_type, back to the AI Client",
    () =>
      Effect.gen(function* () {
        const clientId = anAiClient();

        const invalid: ReadonlyArray<[Record<string, string | undefined>, AuthorizationErrorCode]> =
          [
            [{ response_type: "token" }, "unsupported_response_type"],
            [{ code_challenge_method: "plain" }, "invalid_request"],
            [{ code_challenge: undefined }, "invalid_request"],
            [{ code_challenge: "too-short" }, "invalid_request"],
            [{ resource: `${publicOrigin}/api` }, "invalid_target"],
            [{ resource: undefined }, "invalid_target"],
          ];

        for (const [params, error] of invalid) {
          // An `undefined` leaves the parameter out of the request.
          const request: AuthorizationRequestParams = Object.fromEntries(
            Object.entries({ ...requestOf(clientId), ...params }).filter(
              ([, value]) => value !== undefined,
            ),
          );

          assert.deepStrictEqual(yield* refusal(request), { error, redirect_uri: redirectUri });
        }
      }),
  );

  it.effect("asks only for Permissions an AI Client may hold, once each", () =>
    Effect.gen(function* () {
      const clientId = anAiClient();

      for (const scope of ["users:list", "todos:list users:list", "todos:read", "", "  "]) {
        assert.deepStrictEqual(yield* refusal(requestOf(clientId, { scope })), {
          error: "invalid_scope",
          redirect_uri: redirectUri,
        });
      }

      const request = yield* check(
        requestOf(clientId, { scope: "todos:delete  todos:list todos:delete" }),
      );

      assert.deepStrictEqual(request.permissions, ["todos:list", "todos:delete"]);
    }),
  );

  it.effect("reuses a document as long as its Cache-Control says", () =>
    Effect.gen(function* () {
      const cached = anAiClient({}, { "cache-control": "public, max-age=60" });
      const notStored = anAiClient({}, { "cache-control": "no-store" });
      const silent = anAiClient();

      for (const clientId of [cached, notStored, silent]) {
        yield* check(requestOf(clientId));
        yield* check(requestOf(clientId));
      }

      assert.strictEqual(fetchesOf(cached), 1);
      assert.strictEqual(fetchesOf(notStored), 2);
      assert.strictEqual(fetchesOf(silent), 2);

      yield* TestClock.adjust("61 seconds");
      yield* check(requestOf(cached));
      assert.strictEqual(fetchesOf(cached), 2);
    }),
  );

  it.effect("reuses a document until it Expires, for its s-maxage, and less its Age", () =>
    Effect.gen(function* () {
      const date = "Sun, 01 Nov 2026 10:00:00 GMT";
      const expiring = anAiClient({}, { date, expires: "Sun, 01 Nov 2026 10:00:30 GMT" });
      const shared = anAiClient({}, { "cache-control": "max-age=0, s-maxage=30" });
      const aged = anAiClient({}, { "cache-control": "max-age=30", age: "30" });

      for (const clientId of [expiring, shared, aged]) {
        yield* check(requestOf(clientId));
        yield* check(requestOf(clientId));
      }

      assert.strictEqual(fetchesOf(expiring), 1);
      assert.strictEqual(fetchesOf(shared), 1);
      assert.strictEqual(fetchesOf(aged), 2);

      yield* TestClock.adjust("31 seconds");
      yield* check(requestOf(expiring));
      yield* check(requestOf(shared));
      assert.strictEqual(fetchesOf(expiring), 2);
      assert.strictEqual(fetchesOf(shared), 2);
    }),
  );
});

layer(withConfig({ AI_CLIENT_LOOPBACK_HTTP: "true" }))(
  "OAuthApi checkAuthorization, with loopback AI Clients allowed",
  (it) => {
    it.effect("accepts an http document on this machine, but no other http one", () =>
      Effect.gen(function* () {
        const local = "http://localhost:6274/oauth/client.json";
        const remote = "http://ai.example.com/oauth/client.json";
        serve(local, () => json(documentOf(local)));
        serve(remote, () => json(documentOf(remote)));

        const request = yield* check(requestOf(local));

        assert.strictEqual(request.aiClient.host, "localhost");
        assert.strictEqual((yield* refusal(requestOf(remote)))?.error, "invalid_client");
      }),
    );
  },
);

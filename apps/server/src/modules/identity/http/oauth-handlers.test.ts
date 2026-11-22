import { assert, describe, effect, layer } from "@effect/vitest";
import { Api } from "@quack/contracts/api";
import { Authentication } from "@quack/contracts/identity/authentication";
import { GrantId } from "@quack/contracts/grants/grant";
import { Email, User, UserId } from "@quack/contracts/identity/user";
import type { AuthorizationRequestParams } from "@quack/contracts/oauth/authorization-request";
import type { AuthorizationErrorCode } from "@quack/contracts/oauth/oauth-errors";
import type { TokenRequestParams } from "@quack/contracts/oauth/token-request";
import type { Permission } from "@quack/contracts/permission";
import { ConfigProvider, DateTime, Effect, Fiber, Layer, Option, Redacted, Schema } from "effect";
import { HttpClient, HttpClientRequest, HttpClientResponse, HttpServer } from "effect/http";
import { HttpApiMiddleware, HttpApiTest } from "effect/http-api";
import { TestClock } from "effect/testing";

import { AuthorizationCodeStore } from "#/modules/identity/domain/authorization-code-store.ts";
import { GrantStore } from "#/modules/identity/domain/grant-store.ts";
import { UserRepository } from "#/modules/identity/domain/user-repository.ts";
import { Grants, AiClientsModule } from "#/modules/identity/index.ts";
import { AuthorizationCodeStoreMemory } from "#/modules/identity/testing/authorization-code-store-memory.ts";
import { GrantStoreMemory } from "#/modules/identity/testing/grant-store-memory.ts";
import { UserRepositoryMemory } from "#/modules/identity/testing/user-repository-memory.ts";
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

const grace = new User({
  ...ada,
  id: UserId.make("grace"),
  email: Email.make("grace@example.com"),
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

const clientOf = (user: User) =>
  HttpApiTest.groups(Api, ["oauth", "grants"]).pipe(
    Effect.provide(
      HttpApiMiddleware.layerClient(Authentication, ({ next, request }) =>
        next(HttpClientRequest.setHeader(request, "cookie", `session=${user.id}`)),
      ),
    ),
  );

const client = clientOf(ada);

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

const withEnv = (env: Record<string, string>) =>
  Layer.mergeAll(
    AiClientsModule.pipe(
      Layer.provide(StubHttpClient),
      Layer.provideMerge(AuthorizationCodeStoreMemory),
      Layer.provideMerge(GrantStoreMemory),
      Layer.provideMerge(UserRepositoryMemory),
      Layer.provideMerge(authenticationByUserId([ada, grace])),
      Layer.provide(
        ConfigProvider.layer(ConfigProvider.fromUnknown({ PUBLIC_URL: publicOrigin, ...env })),
      ),
    ),
    HttpServer.layerServices,
  );

// The tests of one layer share its AttemptLimiter, and would count each other's attempts.
const withConfig = (env: Record<string, string>) =>
  withEnv({ CLIENT_DOCUMENT_FETCHES_PER_USER: "10000", TOKEN_FAILURES_PER_IP: "10000", ...env });

/** Services of the test's own, with the limits of the config. */
const withLimits = (env: Record<string, string> = {}) => Effect.provide(withEnv(env));

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
      assert.deepStrictEqual(request.grantablePermissions, [
        "todos:list",
        "todos:write",
        "todos:delete",
      ]);
      assert.isNull(request.grantedPermissions);
      assert.isFalse(request.consentRemembered);
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

const approve = (
  payload: AuthorizationRequestParams & {
    readonly csrfToken: string;
    readonly permissions: ReadonlyArray<Permission>;
  },
) => Effect.flatMap(client, (api) => api.oauth.approveAuthorization({ payload }));

const deny = (payload: AuthorizationRequestParams & { readonly csrfToken: string }) =>
  Effect.flatMap(client, (api) => api.oauth.denyAuthorization({ payload }));

/**
 * Checks the request as the consent page does, and answers it with the page's CSRF token and the Permissions the
 * User ticks: by default, those the request asks for.
 */
const onTheConsentPage = (
  payload: AuthorizationRequestParams,
  ticked?: ReadonlyArray<Permission>,
) =>
  Effect.map(check(payload), ({ csrfToken, permissions }) => ({
    ...payload,
    csrfToken,
    permissions: ticked ?? permissions,
  }));

const sha256Hex = (text: string) =>
  Effect.promise(async () =>
    Buffer.from(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text))).toString(
      "hex",
    ),
  );

layer(withConfig({}))("OAuthApi approveAuthorization and denyAuthorization", (it) => {
  it.effect(
    "approving sends the User back to the AI Client with a code, the state, and Quack as the issuer",
    () =>
      Effect.gen(function* () {
        const clientId = anAiClient();
        const decision = yield* onTheConsentPage(requestOf(clientId, { state: "xyz 123" }));

        const { redirectTo } = yield* approve(decision);

        const url = new URL(redirectTo);
        assert.strictEqual(`${url.origin}${url.pathname}`, redirectUri);
        assert.strictEqual(url.searchParams.get("state"), "xyz 123");
        assert.strictEqual(url.searchParams.get("iss"), publicOrigin);
        assert.isNull(url.searchParams.get("error"));
        assert.match(url.searchParams.get("code") ?? "", /^[A-Za-z0-9_-]{43}$/);
      }),
  );

  it.effect("the code redeems once, for what the User approved, for one minute", () =>
    Effect.gen(function* () {
      const clientId = anAiClient({
        redirect_uris: ["http://localhost/callback"],
      });

      const decision = yield* onTheConsentPage(
        requestOf(clientId, {
          redirect_uri: "http://localhost:51234/callback",
          scope: "todos:delete todos:list",
        }),
      );

      const now = yield* DateTime.now;

      const code = new URL((yield* approve(decision)).redirectTo).searchParams.get("code") ?? "";
      const store = yield* AuthorizationCodeStore;
      const codeHash = yield* sha256Hex(code);

      assert.deepStrictEqual(
        yield* store.take(codeHash),
        Option.some({
          codeHash,
          userId: ada.id,
          aiClientId: clientId,
          aiClientName: "Claude",
          redirectUri: "http://localhost:51234/callback",
          resource,
          permissions: ["todos:list", "todos:delete"],
          codeChallenge: "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM",
          expiresAt: DateTime.add(now, { minutes: 1 }),
        }),
      );
      assert.isTrue(Option.isNone(yield* store.take(codeHash)));
    }),
  );

  it.effect("each approval gets a code of its own", () =>
    Effect.gen(function* () {
      const decision = yield* onTheConsentPage(requestOf(anAiClient()));

      const codes = new Set<string | null>();

      for (let i = 0; i < 3; i++) {
        codes.add(new URL((yield* approve(decision)).redirectTo).searchParams.get("code"));
      }

      assert.strictEqual(codes.size, 3);
    }),
  );

  it.effect("leaves out the state when the AI Client sent none", () =>
    Effect.gen(function* () {
      const decision = yield* onTheConsentPage(requestOf(anAiClient()));

      const approved = new URL((yield* approve(decision)).redirectTo);
      const denied = new URL((yield* deny(decision)).redirectTo);

      assert.isFalse(approved.searchParams.has("state"));
      assert.isFalse(denied.searchParams.has("state"));
    }),
  );

  it.effect("denying sends the User back to the AI Client with access_denied, and no code", () =>
    Effect.gen(function* () {
      const decision = yield* onTheConsentPage(requestOf(anAiClient(), { state: "abc" }));

      const url = new URL((yield* deny(decision)).redirectTo);

      assert.strictEqual(`${url.origin}${url.pathname}`, redirectUri);
      assert.strictEqual(url.searchParams.get("error"), "access_denied");
      assert.strictEqual(url.searchParams.get("state"), "abc");
      assert.strictEqual(url.searchParams.get("iss"), publicOrigin);
      assert.isFalse(url.searchParams.has("code"));
    }),
  );

  it.effect("refuses a decision that does not carry the CSRF token of the consent page", () =>
    Effect.gen(function* () {
      const request = requestOf(anAiClient());
      const { csrfToken } = yield* check(request);

      for (const forged of ["", "forged", `${csrfToken}x`, csrfToken.slice(1)]) {
        const decision = { ...request, csrfToken: forged, permissions: ["todos:list"] as const };
        assert.strictEqual((yield* Effect.flip(approve(decision)))._tag, "InvalidCsrfToken");
        assert.strictEqual((yield* Effect.flip(deny(decision)))._tag, "InvalidCsrfToken");
      }
    }),
  );

  it.effect(
    "validates the request again, so a decision never sends the User where the AI Client does not list",
    () =>
      Effect.gen(function* () {
        const clientId = anAiClient();
        const { csrfToken } = yield* check(requestOf(clientId));

        const tampered = {
          ...requestOf(clientId, { redirect_uri: "https://evil.example.com/callback" }),
          csrfToken,
          permissions: ["todos:list"] as const,
        };

        for (const decide of [approve, deny]) {
          const error = yield* Effect.flip(decide(tampered));
          assert.strictEqual(error._tag, "AuthorizationRequestRefused");
        }
      }),
  );
});

const token = (payload: TokenRequestParams) =>
  Effect.flatMap(client, (api) => api.oauth.token({ payload }));

const tokenRefusal = (payload: TokenRequestParams) =>
  token(payload).pipe(
    Effect.flip,
    Effect.map((error) => (error._tag === "TokenRequestRefused" ? error.error : error._tag)),
  );

/** The verifier of the challenge `requestOf` sends (RFC 7636 appendix B). */
const codeVerifier = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk";

/**
 * Ada approves the request, with the Permissions she ticks (by default, those it asks for): answers the code, and the
 * token request that exchanges it.
 */
const approvedCode = (params: ReturnType<typeof requestOf>, ticked?: ReadonlyArray<Permission>) =>
  Effect.gen(function* () {
    const decision = yield* onTheConsentPage(params, ticked);
    const code = new URL((yield* approve(decision)).redirectTo).searchParams.get("code") ?? "";

    return {
      grant_type: "authorization_code",
      code,
      redirect_uri: params.redirect_uri,
      client_id: params.client_id,
      code_verifier: codeVerifier,
      resource: params.resource,
    } satisfies TokenRequestParams;
  });

layer(withConfig({}))("OAuthApi approveAuthorization, the Grant", (it) => {
  it.effect("approving stores the Grant of the User to the AI Client, for 30 days", () =>
    Effect.gen(function* () {
      const clientId = anAiClient();
      const now = yield* DateTime.now;

      yield* approvedCode(requestOf(clientId));

      const grant = yield* (yield* GrantStore).findOf(ada.id, clientId);
      assert.deepStrictEqual(
        Option.map(grant, ({ id: _, ...terms }) => terms),
        Option.some({
          userId: ada.id,
          aiClientId: clientId,
          aiClientName: "Claude",
          redirectUri,
          resource,
          permissions: ["todos:list", "todos:write"] as ReadonlyArray<Permission>,
          expiresAt: DateTime.add(now, { days: 30 }),
          lastUsedAt: null,
        }),
      );
    }),
  );

  it.effect("approving the same AI Client again updates its one Grant", () =>
    Effect.gen(function* () {
      const clientId = anAiClient();
      yield* approvedCode(requestOf(clientId));
      const store = yield* GrantStore;
      const first = yield* store.findOf(ada.id, clientId);

      yield* approvedCode(requestOf(clientId, { scope: "todos:delete" }));

      const second = yield* store.findOf(ada.id, clientId);
      assert.deepStrictEqual(
        Option.map(second, ({ id, permissions }) => ({ id, permissions })),
        Option.map(first, ({ id }) => ({
          id,
          permissions: ["todos:delete"] as ReadonlyArray<Permission>,
        })),
      );
    }),
  );

  it.effect.each([
    { case: "fewer", asked: "todos:list todos:write", ticked: ["todos:write"] },
    { case: "more", asked: "todos:list", ticked: ["todos:delete", "todos:list"] },
  ] as const)(
    "the Grant and its tokens hold what the User ticked, $case than asked, and the scope names it",
    ({ asked, ticked }) =>
      Effect.gen(function* () {
        const clientId = anAiClient();
        const exchange = yield* approvedCode(requestOf(clientId, { scope: asked }), ticked);

        const grant = yield* (yield* GrantStore).findOf(ada.id, clientId);
        const response = yield* token(exchange);

        const expected = ticked.length === 1 ? ["todos:write"] : ["todos:list", "todos:delete"];
        assert.deepStrictEqual(
          Option.map(grant, ({ permissions }) => permissions),
          Option.some(expected as ReadonlyArray<Permission>),
        );
        assert.strictEqual(response.scope, expected.join(" "));
      }),
  );

  it.effect("refuses an approval of nothing, or of a Permission no Grant may hold", () =>
    Effect.gen(function* () {
      const clientId = anAiClient();

      for (const ticked of [[], ["users:list"], ["todos:list", "users:list"]] as const) {
        const error = yield* Effect.flip(
          approve(yield* onTheConsentPage(requestOf(clientId), ticked)),
        );

        assert.deepStrictEqual(
          error._tag === "AuthorizationRequestRefused" ? error.error : error._tag,
          "invalid_scope",
        );
      }

      assert.isTrue(Option.isNone(yield* (yield* GrantStore).findOf(ada.id, clientId)));
    }),
  );

  it.effect("the consent page then knows the Permissions of the Grant", () =>
    Effect.gen(function* () {
      const clientId = anAiClient();
      yield* approvedCode(requestOf(clientId));

      const request = yield* check(requestOf(clientId, { scope: "todos:delete" }));

      assert.deepStrictEqual(request.grantedPermissions, ["todos:list", "todos:write"]);
      assert.isFalse(request.consentRemembered);
    }),
  );
});

layer(withConfig({}))("OAuthApi token", (it) => {
  it.effect("exchanges a code for an access token of the Grant, valid one hour", () =>
    Effect.gen(function* () {
      const exchange = yield* approvedCode(requestOf(anAiClient()));

      const response = yield* token(exchange);

      assert.deepStrictEqual(
        {
          ...response,
          access_token: response.access_token.length,
          refresh_token: response.refresh_token.length,
        },
        {
          access_token: 43,
          token_type: "Bearer",
          expires_in: 3600,
          scope: "todos:list todos:write",
          refresh_token: 43,
        },
      );
    }),
  );

  it.effect("gives every token a refresh token of its own", () =>
    Effect.gen(function* () {
      const clientId = anAiClient();
      const first = yield* token(yield* approvedCode(requestOf(clientId)));
      const second = yield* token(yield* approvedCode(requestOf(clientId)));

      assert.notStrictEqual(first.refresh_token, second.refresh_token);
      assert.notStrictEqual(first.refresh_token, first.access_token);
    }),
  );

  it.effect("exchanges a code for an AI Client on this machine at the port it came back on", () =>
    Effect.gen(function* () {
      const clientId = anAiClient({ redirect_uris: ["http://localhost/callback"] });

      const exchange = yield* approvedCode(
        requestOf(clientId, { redirect_uri: "http://localhost:51234/callback" }),
      );

      assert.strictEqual((yield* token(exchange)).token_type, "Bearer");
    }),
  );

  it.effect("refuses the code of an AI Client on this machine at another port", () =>
    Effect.gen(function* () {
      const clientId = anAiClient({ redirect_uris: ["http://localhost/callback"] });

      const exchange = yield* approvedCode(
        requestOf(clientId, { redirect_uri: "http://localhost:51234/callback" }),
      );

      assert.strictEqual(
        yield* tokenRefusal({ ...exchange, redirect_uri: "http://localhost:40001/callback" }),
        "invalid_grant",
      );
    }),
  );

  it.effect("exchanges a code once", () =>
    Effect.gen(function* () {
      const exchange = yield* approvedCode(requestOf(anAiClient()));
      yield* token(exchange);

      assert.strictEqual(yield* tokenRefusal(exchange), "invalid_grant");
    }),
  );

  it.effect("refuses a code past its minute", () =>
    Effect.gen(function* () {
      const exchange = yield* approvedCode(requestOf(anAiClient()));

      yield* TestClock.adjust("61 seconds");

      assert.strictEqual(yield* tokenRefusal(exchange), "invalid_grant");
    }),
  );

  it.effect.each([
    ["another grant type", { grant_type: "client_credentials" }, "unsupported_grant_type"],
    ["no grant type", { grant_type: undefined }, "invalid_request"],
    ["no code", { code: undefined }, "invalid_request"],
    ["a code Quack never gave", { code: "not-a-code-of-quack" }, "invalid_grant"],
    ["no verifier", { code_verifier: undefined }, "invalid_request"],
    [
      "a verifier that does not answer the challenge",
      { code_verifier: `${codeVerifier}x` },
      "invalid_grant",
    ],
    ["another redirect URI", { redirect_uri: "https://claude.ai/other" }, "invalid_grant"],
    ["another AI Client", { client_id: "https://evil.example.com/client.json" }, "invalid_grant"],
    ["another resource", { resource: "https://other.test/api/mcp" }, "invalid_target"],
    ["no resource", { resource: undefined }, "invalid_target"],
  ] as const)("refuses a code exchanged with %s", ([_, change, error]) =>
    Effect.gen(function* () {
      const exchange = yield* approvedCode(requestOf(anAiClient()));

      const changed = Object.fromEntries(
        Object.entries({ ...exchange, ...change }).filter(([, value]) => value !== undefined),
      );

      assert.strictEqual(yield* tokenRefusal(changed), error);
    }),
  );

  it.effect("a refused exchange spends the code", () =>
    Effect.gen(function* () {
      const exchange = yield* approvedCode(requestOf(anAiClient()));
      yield* tokenRefusal({ ...exchange, code_verifier: `${codeVerifier}x` });

      assert.strictEqual(yield* tokenRefusal(exchange), "invalid_grant");
    }),
  );
});

// Ada must be stored for her Grant to act; each test may be the first to need her.
const storeAda = Effect.gen(function* () {
  yield* (yield* UserRepository).create(ada, "unused").pipe(Effect.ignore);
});

/** The Permissions an access token opens, as `/api/mcp` will act with them. */
const permissionsOf = (accessToken: string) =>
  Effect.gen(function* () {
    yield* storeAda;

    const { permissions } = yield* (yield* Grants).authenticate(Redacted.make(accessToken));

    return [...permissions].toSorted();
  });

layer(withConfig({}))("OAuthApi token, the Permissions of a token", (it) => {
  it.effect(
    "a code gives no more than was approved with it, though the User approved more since",
    () =>
      Effect.gen(function* () {
        const clientId = anAiClient();
        const narrow = yield* approvedCode(requestOf(clientId, { scope: "todos:list" }));
        yield* approvedCode(requestOf(clientId, { scope: "todos:list todos:delete" }));

        const response = yield* token(narrow);

        assert.strictEqual(response.scope, "todos:list");
        assert.deepStrictEqual(yield* permissionsOf(response.access_token), ["todos:list"]);
      }),
  );

  it.effect("a token opens nothing once the User approves the AI Client again", () =>
    Effect.gen(function* () {
      const clientId = anAiClient();
      const wide = yield* approvedCode(requestOf(clientId, { scope: "todos:list todos:delete" }));
      const { access_token } = yield* token(wide);

      yield* approvedCode(requestOf(clientId, { scope: "todos:list" }));
      const error = yield* Effect.flip(permissionsOf(access_token));

      assert.strictEqual(error._tag, "Unauthenticated");
    }),
  );
});

/** Whether `/api/mcp` takes the access token. */
const opens = (accessToken: string) =>
  permissionsOf(accessToken).pipe(
    Effect.as(true),
    Effect.catchTag("Unauthenticated", () => Effect.succeed(false)),
  );

/** Ada approves a new AI Client and it exchanges the code: answers the tokens, and its client id. */
const tokensOfANewAiClient = (scope = "todos:list todos:write") =>
  Effect.gen(function* () {
    yield* storeAda;
    const clientId = anAiClient();
    const tokens = yield* token(yield* approvedCode(requestOf(clientId, { scope })));

    return { clientId, ...tokens };
  });

/** The refresh of `tokens`: a field `change` sets to undefined is left out. */
const refreshing = (
  { clientId, refresh_token }: { clientId: string; refresh_token: string },
  change: Readonly<Record<string, string | undefined>> = {},
): TokenRequestParams =>
  Object.fromEntries(
    Object.entries({
      grant_type: "refresh_token",
      refresh_token,
      client_id: clientId,
      resource,
      ...change,
    }).filter(([, value]) => value !== undefined),
  );

layer(withConfig({}))("OAuthApi token, a refresh", (it) => {
  it.effect("trades a refresh token for new tokens of the same Grant, as the code gave them", () =>
    Effect.gen(function* () {
      const tokens = yield* tokensOfANewAiClient("todos:list");

      const refreshed = yield* token(refreshing(tokens));

      assert.deepStrictEqual(
        { ...refreshed, access_token: undefined, refresh_token: undefined },
        {
          access_token: undefined,
          token_type: "Bearer",
          expires_in: 3600,
          scope: "todos:list",
          refresh_token: undefined,
        },
      );
      assert.notStrictEqual(refreshed.access_token, tokens.access_token);
      assert.notStrictEqual(refreshed.refresh_token, tokens.refresh_token);
      assert.deepStrictEqual(yield* permissionsOf(refreshed.access_token), ["todos:list"]);
    }),
  );

  it.effect("the resource may be left out of a refresh: the token keeps its own", () =>
    Effect.gen(function* () {
      const tokens = yield* tokensOfANewAiClient();

      const refreshed = yield* token(refreshing(tokens, { resource: undefined }));

      assert.isTrue(yield* opens(refreshed.access_token));
    }),
  );

  it.effect(
    "a refresh token given before the User approves the AI Client again refreshes nothing",
    () =>
      Effect.gen(function* () {
        const tokens = yield* tokensOfANewAiClient("todos:list todos:delete");
        yield* approvedCode(requestOf(tokens.clientId, { scope: "todos:list" }));

        assert.strictEqual(yield* tokenRefusal(refreshing(tokens)), "invalid_grant");
      }),
  );

  it.effect("each refresh token is replaced on use: the new one refreshes in turn", () =>
    Effect.gen(function* () {
      const tokens = yield* tokensOfANewAiClient();
      const second = yield* token(refreshing(tokens));

      const third = yield* token(refreshing({ ...tokens, ...second }));

      assert.isTrue(yield* opens(third.access_token));
    }),
  );

  it.effect("a refresh token presented again revokes the whole Grant", () =>
    Effect.gen(function* () {
      const tokens = yield* tokensOfANewAiClient();
      const refreshed = yield* token(refreshing(tokens));

      assert.strictEqual(yield* tokenRefusal(refreshing(tokens)), "invalid_grant");

      assert.isFalse(yield* opens(refreshed.access_token));
      assert.isFalse(yield* opens(tokens.access_token));
      assert.strictEqual(
        yield* tokenRefusal(refreshing({ ...tokens, ...refreshed })),
        "invalid_grant",
      );
      assert.isTrue(Option.isNone(yield* (yield* GrantStore).findOf(ada.id, tokens.clientId)));
    }),
  );

  it.effect("a Grant lasts 30 days from its last refresh, with no other limit", () =>
    Effect.gen(function* () {
      const { clientId, ...first } = yield* tokensOfANewAiClient();
      let { refresh_token } = first;

      for (let refresh = 0; refresh < 3; refresh++) {
        yield* TestClock.adjust("29 days");
        ({ refresh_token } = yield* token(refreshing({ clientId, refresh_token })));
      }

      yield* TestClock.adjust("30 days");

      assert.strictEqual(
        yield* tokenRefusal(refreshing({ clientId, refresh_token })),
        "invalid_grant",
      );
    }),
  );

  it.effect("the access token of an expired Grant opens nothing", () =>
    Effect.gen(function* () {
      const tokens = yield* tokensOfANewAiClient();
      const store = yield* GrantStore;

      const grant = yield* store
        .findOf(ada.id, tokens.clientId)
        .pipe(Effect.map(Option.getOrThrow));

      // A Grant whose 30 days end within the hour of its token.
      yield* store.save({
        ...grant,
        expiresAt: DateTime.add(yield* DateTime.now, { minutes: 10 }),
      });

      yield* TestClock.adjust("10 minutes");

      assert.isFalse(yield* opens(tokens.access_token));
    }),
  );

  it.effect.each([
    ["no refresh token", { refresh_token: undefined }, "invalid_request"],
    [
      "a refresh token Quack never gave",
      { refresh_token: "not-a-token-of-quack" },
      "invalid_grant",
    ],
    ["another AI Client", { client_id: "https://evil.example.com/client.json" }, "invalid_grant"],
    ["no AI Client", { client_id: undefined }, "invalid_grant"],
    ["another resource", { resource: "https://other.test/api/mcp" }, "invalid_target"],
  ] as const)(
    "refuses a refresh with %s, and leaves the refresh token as it was",
    ([_, change, error]) =>
      Effect.gen(function* () {
        const tokens = yield* tokensOfANewAiClient();

        assert.strictEqual(yield* tokenRefusal(refreshing(tokens, change)), error);

        assert.isTrue(yield* opens((yield* token(refreshing(tokens))).access_token));
      }),
  );
});

// Ada is suspended here: the other tests need her active, so this one test has services of its own.
layer(withConfig({}))("OAuthApi token, a User no longer active", (it) => {
  it.effect("loses their Grant at their AI Client's next call", () =>
    Effect.gen(function* () {
      const tokens = yield* tokensOfANewAiClient();
      assert.isTrue(yield* opens(tokens.access_token));

      yield* (yield* UserRepository).update(new User({ ...ada, status: "suspended" }));

      assert.isFalse(yield* opens(tokens.access_token));
      assert.isTrue(Option.isNone(yield* (yield* GrantStore).findOf(ada.id, tokens.clientId)));
      assert.strictEqual(yield* tokenRefusal(refreshing(tokens)), "invalid_grant");
    }),
  );
});

layer(withConfig({ OAUTH_REMEMBER_CONSENT: "true" }))("OAuthApi, remembered consent", (it) => {
  it.effect("remembers the consent to a request the Grant holds all of, though it holds more", () =>
    Effect.gen(function* () {
      const clientId = anAiClient();
      yield* approvedCode(requestOf(clientId, { scope: "todos:list" }), [
        "todos:list",
        "todos:write",
      ]);

      const asked = yield* check(requestOf(clientId, { scope: "todos:write" }));
      const more = yield* check(requestOf(clientId, { scope: "todos:write todos:delete" }));

      assert.isTrue(asked.consentRemembered);
      assert.isFalse(more.consentRemembered);
    }),
  );
});

describe("OAuthApi, attempt limits", () => {
  effect(
    "refuses a check after 30 fetches of a document for one User in 15 minutes: TooManyAttempts",
    () =>
      Effect.gen(function* () {
        const cached = anAiClient({}, { "cache-control": "max-age=3600" });
        yield* check(requestOf(cached));

        for (let fetch = 1; fetch < 30; fetch++) {
          yield* TestClock.adjust("10 seconds");
          yield* check(requestOf(anAiClient()));
        }

        const fresh = anAiClient();
        const refused = yield* check(requestOf(fresh)).pipe(Effect.flip);
        const fromCache = yield* check(requestOf(cached));

        const forGrace = yield* Effect.flatMap(clientOf(grace), (api) =>
          api.oauth.checkAuthorization({ payload: requestOf(fresh) }),
        );

        assert.deepStrictEqual(
          { _tag: refused._tag, retryAfter: "retryAfter" in refused ? refused.retryAfter : 0 },
          { _tag: "TooManyAttempts", retryAfter: 900 - 290 },
        );
        assert.strictEqual(fromCache.aiClient.id, cached);
        assert.strictEqual(forGrace.aiClient.id, fresh);
        assert.strictEqual(fetchesOf(fresh), 1);
      }).pipe(withLimits()),
  );

  effect(
    "refuses a token request after 20 failed exchanges in 15 minutes, and counts no success",
    () =>
      Effect.gen(function* () {
        const tokens = yield* tokensOfANewAiClient();

        for (let refresh = 0; refresh < 25; refresh++) {
          Object.assign(tokens, yield* token(refreshing(tokens)));
        }

        const failures = yield* Effect.forEach(Array.from({ length: 20 }), () =>
          tokenRefusal(refreshing(tokens, { refresh_token: "not-a-token-of-quack" })),
        );

        yield* TestClock.adjust("5 minutes");
        const refused = yield* token(refreshing(tokens)).pipe(Effect.flip);
        yield* TestClock.adjust("10 minutes");
        const afterTheWindow = yield* token(refreshing(tokens));

        assert.deepStrictEqual(
          failures,
          Array.from({ length: 20 }, () => "invalid_grant"),
        );
        assert.deepStrictEqual(
          { _tag: refused._tag, retryAfter: "retryAfter" in refused ? refused.retryAfter : 0 },
          { _tag: "TooManyAttempts", retryAfter: 600 },
        );
        assert.isTrue(yield* opens(afterTheWindow.access_token));
      }).pipe(withLimits()),
  );

  effect("takes the limits of the OAuth routes and their windows from the config", () =>
    Effect.gen(function* () {
      const fetchedOnce = anAiClient();
      yield* check(requestOf(fetchedOnce));
      const refusedCheck = yield* check(requestOf(anAiClient())).pipe(Effect.flip);
      yield* tokenRefusal(refreshing({ clientId: fetchedOnce, refresh_token: "unknown" }));

      const refusedToken = yield* token(
        refreshing({ clientId: fetchedOnce, refresh_token: "unknown" }),
      ).pipe(Effect.flip);

      assert.deepStrictEqual(
        [refusedCheck, refusedToken].map((error) => ({
          _tag: error._tag,
          retryAfter: "retryAfter" in error ? error.retryAfter : 0,
        })),
        [
          { _tag: "TooManyAttempts", retryAfter: 60 },
          { _tag: "TooManyAttempts", retryAfter: 30 },
        ],
      );
    }).pipe(
      withLimits({
        CLIENT_DOCUMENT_FETCHES_PER_USER: "1",
        CLIENT_DOCUMENT_FETCHES_PER_USER_WINDOW: "1 minute",
        TOKEN_FAILURES_PER_IP: "1",
        TOKEN_FAILURES_PER_IP_WINDOW: "30 seconds",
      }),
    ),
  );
});

const listGrants = Effect.flatMap(client, (api) => api.grants.list());

const revokeGrant = (id: GrantId) =>
  Effect.flatMap(client, (api) => api.grants.revoke({ params: { id } }));

const changePermissions = (id: GrantId, permissions: readonly [Permission, ...Array<Permission>]) =>
  Effect.flatMap(client, (api) =>
    api.grants.changePermissions({ params: { id }, payload: { permissions } }),
  );

/** Ada's Grant to the AI Client, as her settings list it. */
const grantListed = (clientId: string) =>
  Effect.map(listGrants, (grants) => grants.find((grant) => grant.aiClient.id === clientId));

layer(withConfig({}))("GrantsApi", (it) => {
  it.effect("lists the Grants of the Current User, as the AI Clients section shows them", () =>
    Effect.gen(function* () {
      const clientId = anAiClient();
      const now = yield* DateTime.now;
      yield* approvedCode(requestOf(clientId));

      const grant = yield* grantListed(clientId);

      assert.deepStrictEqual(
        grant && {
          aiClient: grant.aiClient,
          loopbackOnly: grant.loopbackOnly,
          permissions: grant.permissions,
          lastUsedAt: grant.lastUsedAt,
          expiresAt: grant.expiresAt,
        },
        {
          aiClient: { id: clientId, host: new URL(clientId).hostname, name: "Claude" },
          loopbackOnly: false,
          permissions: ["todos:list", "todos:write"],
          lastUsedAt: null,
          expiresAt: DateTime.add(now, { days: 30 }),
        },
      );
    }),
  );

  it.effect("says when an AI Client comes back on this machine", () =>
    Effect.gen(function* () {
      const clientId = anAiClient({ redirect_uris: ["http://localhost/callback"] });
      yield* approvedCode(requestOf(clientId, { redirect_uri: "http://localhost:51234/callback" }));

      assert.isTrue((yield* grantListed(clientId))?.loopbackOnly);
    }),
  );

  it.effect("lists no Grant of another User, and no expired one", () =>
    Effect.gen(function* () {
      const store = yield* GrantStore;
      const clientId = anAiClient();
      yield* approvedCode(requestOf(clientId));
      const grant = yield* store.findOf(ada.id, clientId).pipe(Effect.map(Option.getOrThrow));
      const now = yield* DateTime.now;
      const others = anAiClient();
      yield* store.save({ ...grant, userId: grace.id, aiClientId: others });

      yield* store.save({ ...grant, expiresAt: now });

      assert.isUndefined(yield* grantListed(clientId));
      assert.isUndefined(yield* grantListed(others));
    }),
  );

  it.effect("tells when the AI Client last used its Grant, to the minute", () =>
    Effect.gen(function* () {
      const tokens = yield* tokensOfANewAiClient();
      const first = yield* DateTime.now;

      yield* opens(tokens.access_token);
      assert.deepStrictEqual((yield* grantListed(tokens.clientId))?.lastUsedAt, first);

      yield* TestClock.adjust("59 seconds");
      yield* opens(tokens.access_token);
      assert.deepStrictEqual((yield* grantListed(tokens.clientId))?.lastUsedAt, first);

      yield* TestClock.adjust("1 second");
      yield* opens(tokens.access_token);
      assert.deepStrictEqual(
        (yield* grantListed(tokens.clientId))?.lastUsedAt,
        DateTime.add(first, { minutes: 1 }),
      );
    }),
  );

  it.effect("revoking a Grant cuts its AI Client off at once", () =>
    Effect.gen(function* () {
      const tokens = yield* tokensOfANewAiClient();
      const grant = yield* grantListed(tokens.clientId);

      yield* revokeGrant(grant?.id ?? GrantId.make(""));

      assert.isUndefined(yield* grantListed(tokens.clientId));
      assert.isFalse(yield* opens(tokens.access_token));
      assert.strictEqual(yield* tokenRefusal(refreshing(tokens)), "invalid_grant");
    }),
  );

  it.effect("refuses to revoke a Grant of another User, and leaves it be", () =>
    Effect.gen(function* () {
      const store = yield* GrantStore;

      const others = yield* store.save({
        userId: grace.id,
        aiClientId: anAiClient(),
        aiClientName: "Claude",
        redirectUri,
        resource,
        permissions: ["todos:list"],
        expiresAt: DateTime.add(yield* DateTime.now, { days: 30 }),
      });

      for (const id of [others.id, "unknown"]) {
        const error = yield* Effect.flip(revokeGrant(GrantId.make(id)));
        assert.strictEqual(error._tag, "GrantNotFound");
      }

      assert.isTrue(Option.isSome(yield* store.findOf(others.userId, others.aiClientId)));
    }),
  );

  it.effect(
    "removing Permissions of a Grant takes them from its tokens at once, and from those of a refresh",
    () =>
      Effect.gen(function* () {
        const tokens = yield* tokensOfANewAiClient("todos:list todos:write todos:delete");
        const grant = yield* grantListed(tokens.clientId);

        const changed = yield* changePermissions(grant?.id ?? GrantId.make(""), [
          "todos:list",
          "todos:write",
        ]);

        assert.deepStrictEqual(changed.permissions, ["todos:list", "todos:write"]);
        assert.deepStrictEqual((yield* grantListed(tokens.clientId))?.permissions, [
          "todos:list",
          "todos:write",
        ]);
        assert.deepStrictEqual(yield* permissionsOf(tokens.access_token), [
          "todos:list",
          "todos:write",
        ]);

        const refreshed = yield* token(refreshing(tokens));

        assert.strictEqual(refreshed.scope, "todos:list todos:write");
      }),
  );

  it.effect(
    "adding Permissions to a Grant gives them to its tokens at once, and to those of a refresh",
    () =>
      Effect.gen(function* () {
        const tokens = yield* tokensOfANewAiClient("todos:list");
        const grant = yield* grantListed(tokens.clientId);

        const changed = yield* changePermissions(grant?.id ?? GrantId.make(""), [
          "todos:delete",
          "todos:list",
        ]);

        assert.deepStrictEqual(changed.permissions, ["todos:list", "todos:delete"]);
        assert.deepStrictEqual(yield* permissionsOf(tokens.access_token), [
          "todos:delete",
          "todos:list",
        ]);

        const refreshed = yield* token(refreshing(tokens));

        assert.strictEqual(refreshed.scope, "todos:list todos:delete");
      }),
  );

  it.effect("refuses to give a Grant a Permission no Grant may hold, and leaves it be", () =>
    Effect.gen(function* () {
      const tokens = yield* tokensOfANewAiClient("todos:list todos:write");
      const id = (yield* grantListed(tokens.clientId))?.id ?? GrantId.make("");

      const error = yield* Effect.flip(changePermissions(id, ["todos:list", "users:list"]));

      assert.deepStrictEqual(
        error._tag === "PermissionNotGrantable" ? error.permission : error._tag,
        "users:list",
      );
      assert.deepStrictEqual((yield* grantListed(tokens.clientId))?.permissions, [
        "todos:list",
        "todos:write",
      ]);
    }),
  );

  it.effect("refuses to change a Grant of another User, an expired one, or an unknown one", () =>
    Effect.gen(function* () {
      const store = yield* GrantStore;
      const now = yield* DateTime.now;

      const draft = {
        aiClientName: "Claude",
        redirectUri,
        resource,
        permissions: ["todos:list", "todos:write"] as const,
      };

      const others = yield* store.save({
        ...draft,
        userId: grace.id,
        aiClientId: anAiClient(),
        expiresAt: DateTime.add(now, { days: 30 }),
      });

      const expired = yield* store.save({
        ...draft,
        userId: ada.id,
        aiClientId: anAiClient(),
        expiresAt: now,
      });

      for (const id of [others.id, expired.id, "unknown"]) {
        const error = yield* Effect.flip(changePermissions(GrantId.make(id), ["todos:list"]));
        assert.strictEqual(error._tag, "GrantNotFound");
      }

      for (const grant of [others, expired]) {
        assert.deepStrictEqual(
          Option.map(
            yield* store.findOf(grant.userId, grant.aiClientId),
            (kept) => kept.permissions,
          ),
          Option.some(["todos:list", "todos:write"] as const),
        );
      }
    }),
  );
});

import { assert, layer } from "@effect/vitest";
import { Api } from "@quack/contracts/api";
import { Authentication } from "@quack/contracts/identity/authentication";
import { Forbidden } from "@quack/contracts/identity/identity-errors";
import { Email } from "@quack/contracts/identity/user";
import { RequiredPermission } from "@quack/contracts/permission";
import { ConfigProvider, Effect, Layer, Redacted } from "effect";
import { Cookies, HttpClientRequest, HttpServer } from "effect/http";
import {
  HttpApi,
  HttpApiBuilder,
  HttpApiEndpoint,
  HttpApiGroup,
  HttpApiMiddleware,
  HttpApiSchema,
  HttpApiTest,
} from "effect/http-api";

import { IdentityModule } from "#/modules/identity/index.ts";
import { SessionStoreMemory } from "#/modules/identity/testing/session-store-memory.ts";
import { UserRepositoryMemory } from "#/modules/identity/testing/user-repository-memory.ts";

class ProbeApi extends HttpApi.make("probe").add(
  HttpApiGroup.make("probe")
    .add(
      HttpApiEndpoint.get("open", "/open", { success: HttpApiSchema.NoContent }).annotate(
        RequiredPermission,
        "none",
      ),
      HttpApiEndpoint.get("undeclared", "/undeclared", { success: HttpApiSchema.NoContent }),
    )
    .middleware(Authentication),
) {}

const ProbeHandlers = HttpApiBuilder.group(ProbeApi, "probe", (handlers) =>
  handlers.handle("open", () => Effect.void).handle("undeclared", () => Effect.void),
);

const sessionCookieOf = Effect.fn(function* (email: string) {
  const identity = yield* HttpApiTest.groups(Api, ["identity"]);
  const [, response] = yield* identity.identity.signUp({
    payload: {
      email: Email.make(email),
      password: Redacted.make("correct horse battery staple"),
    },
    responseMode: "decoded-and-response",
  });
  return Cookies.toCookieHeader(response.cookies);
});

const probeAs = (cookie: string) =>
  HttpApiTest.groups(ProbeApi, ["probe"]).pipe(
    Effect.provide(
      HttpApiMiddleware.layerClient(Authentication, ({ next, request }) =>
        next(HttpClientRequest.setHeader(request, "cookie", cookie)),
      ),
    ),
  );

const TestLayer = ProbeHandlers.pipe(
  Layer.provideMerge(IdentityModule),
  Layer.provide([UserRepositoryMemory, SessionStoreMemory]),
  Layer.provideMerge(HttpServer.layerServices),
  Layer.provide(ConfigProvider.layer(ConfigProvider.fromUnknown({}))),
);

layer(TestLayer)("AuthenticationMiddleware", (it) => {
  it.effect("refuses a signed-in caller an endpoint that declares no Permission, 403", () =>
    Effect.gen(function* () {
      const probe = yield* probeAs(yield* sessionCookieOf("rosalind@example.com"));

      const opened = yield* probe.probe.open({ responseMode: "response-only" });
      const error = yield* probe.probe.undeclared().pipe(Effect.flip);
      const refused = yield* probe.probe.undeclared({ responseMode: "response-only" });

      assert.strictEqual(opened.status, 204);
      assert.deepStrictEqual(error, new Forbidden({}));
      assert.strictEqual(refused.status, 403);
    }),
  );
});

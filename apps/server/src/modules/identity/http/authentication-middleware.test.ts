import { assert, layer } from "@effect/vitest";
import { API_PREFIX } from "@quack/contracts/api";
import { IdentityApi } from "@quack/contracts/identity/identity-api";
import { Authentication, CurrentUser } from "@quack/contracts/identity/authentication";
import { Forbidden } from "@quack/contracts/identity/identity-errors";
import { Email, User, UserId } from "@quack/contracts/identity/user";
import { RequiredPermission } from "@quack/contracts/permission";
import { ConfigProvider, DateTime, Effect, Layer, Redacted, Ref } from "effect";
import { Auth } from "@yielded/auth";
import { Cookies, HttpRouter, HttpServer } from "effect/http";
import {
  HttpApi,
  HttpApiBuilder,
  HttpApiEndpoint,
  HttpApiGroup,
  HttpApiMiddleware,
  HttpApiSchema,
  HttpApiTest,
} from "effect/http-api";

import { IdentityModule, localAuthRequest, McpCaller } from "#/modules/identity/index.ts";
import { appAuthTestClient } from "#/modules/identity/testing/app-auth-test-client.ts";
import { IdentityPglite } from "#/modules/identity/testing/identity-pglite.ts";
import { MailerMemory } from "#/modules/mail/testing/mailer-memory.ts";

class ProbeApi extends HttpApi.make("probe").add(
  HttpApiGroup.make("probe")
    .add(
      HttpApiEndpoint.get("open", "/open", { success: HttpApiSchema.NoContent }).annotate(
        RequiredPermission,
        "none",
      ),
      HttpApiEndpoint.get("undeclared", "/undeclared", { success: HttpApiSchema.NoContent }),
      HttpApiEndpoint.get("listTodos", "/todos", { success: HttpApiSchema.NoContent }).annotate(
        RequiredPermission,
        "todos:list",
      ),
    )
    .middleware(Authentication),
) {}

const ProbeHandlers = HttpApiBuilder.group(ProbeApi, "probe", (handlers) =>
  handlers
    .handle("open", () => Effect.void)
    .handle("undeclared", () => Effect.void)
    .handle("listTodos", () => Effect.asVoid(CurrentUser)),
);

// Named as `Api`, whose handlers serve it.
class IdentityOnlyApi extends HttpApi.make("quack").add(IdentityApi).prefix(API_PREFIX) {}

/** The cookies of a browser that signed up as `email`. */
const signedUp = Effect.fn(function* (email: string) {
  const jar = yield* Ref.make(Cookies.empty);
  const identity = yield* appAuthTestClient(IdentityOnlyApi, IdentityModule, jar);

  yield* identity.identity.signUp({
    payload: {
      email: Email.make(email),
      password: Redacted.make("correct horse battery staple"),
      timeZone: DateTime.zoneMakeNamedUnsafe("Europe/Paris"),
    },
  });

  return yield* Ref.get(jar);
});

const probeAs = (cookies: Cookies.Cookies) =>
  Effect.flatMap(Ref.make(cookies), (jar) =>
    appAuthTestClient(ProbeApi, ProbeHandlers.pipe(Layer.provideMerge(IdentityModule)), jar),
  );

const TestLayer = Layer.mergeAll(IdentityPglite, MailerMemory).pipe(
  Layer.provideMerge(HttpServer.layerServices),
  Layer.provideMerge(
    ConfigProvider.layer(ConfigProvider.fromUnknown({ PUBLIC_URL: "https://quack.test" })),
  ),
);

layer(TestLayer)("AuthenticationMiddleware", (it) => {
  it.effect("refuses a signed-in caller an endpoint that declares no Permission, 403", () =>
    Effect.gen(function* () {
      const probe = yield* probeAs(yield* signedUp("rosalind@example.com"));

      const opened = yield* probe.probe.open({ responseMode: "response-only" });
      const error = yield* probe.probe.undeclared().pipe(Effect.flip);
      const refused = yield* probe.probe.undeclared({ responseMode: "response-only" });

      assert.strictEqual(opened.status, 204);
      assert.deepStrictEqual(error, new Forbidden({}));
      assert.strictEqual(refused.status, 403);
    }),
  );

  it.effect(
    "takes the caller of an in-process call from McpCaller, with no cookie, and checks its Permissions",
    () =>
      Effect.gen(function* () {
        // In process, as the MCP transport calls the `Api`: no request, so no Yielded boundary either.
        const probe = yield* HttpApiTest.groups(ProbeApi, ["probe"]).pipe(
          Effect.provide(
            ProbeHandlers.pipe(
              Layer.provideMerge(IdentityModule),
              HttpRouter.provideRequest(Layer.succeed(Auth.AuthRequest, localAuthRequest)),
              Layer.merge(
                HttpApiMiddleware.layerClient(Authentication, ({ next, request }) => next(request)),
              ),
            ),
          ),
        );

        const user = new User({
          id: UserId.make("mcp-caller"),
          email: Email.make("mcp-caller@example.com"),
          role: "admin",
          status: "active",
          createdAt: yield* DateTime.now,
          lastSignInAt: null,
          onboardedAt: null,
          timeZone: DateTime.zoneMakeNamedUnsafe("Europe/Paris"),
          profile: null,
        });

        const as = (permissions: ReadonlyArray<"todos:list" | "todos:write">) =>
          Effect.provideService(McpCaller, { user, permissions: new Set(permissions) });

        const allowed = yield* probe.probe
          .listTodos({ responseMode: "response-only" })
          .pipe(as(["todos:list"]));

        const error = yield* probe.probe.listTodos().pipe(as(["todos:write"]), Effect.flip);

        assert.strictEqual(allowed.status, 204);
        assert.deepStrictEqual(error, new Forbidden({ permission: "todos:list" }));
      }),
  );
});

import { Context, Option } from "effect";
import { HttpApi } from "effect/http-api";
import { describe, expect, it } from "vite-plus/test";

import { Api } from "#/api.ts";
import { Authentication } from "#/identity/authentication.ts";
import { RequiredPermission } from "#/permission.ts";

describe("Api", () => {
  it("declares the Permission of every endpoint behind Authentication", () => {
    const undeclared: Array<string> = [];
    HttpApi.reflect(Api, {
      onGroup: () => {},
      onEndpoint: ({ group, endpoint, middleware }) => {
        const isProtected = [...middleware].some(({ key }) => key === Authentication.key);
        if (
          isProtected &&
          Option.isNone(Context.getOption(endpoint.annotations, RequiredPermission))
        ) {
          undeclared.push(`${group.identifier}.${endpoint.identifier}`);
        }
      },
    });

    expect(undeclared).toEqual([]);
  });
});

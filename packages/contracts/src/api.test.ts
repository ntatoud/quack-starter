import { Context } from "effect";
import { HttpApi } from "effect/http-api";
import { describe, expect, it } from "vite-plus/test";

import { Api } from "#/api.ts";
import { Authentication } from "#/identity/authentication.ts";
import { RequiredPermission } from "#/permission.ts";

const endpointsOf = (api: typeof Api) => {
  const endpoints: Array<{ name: string; isProtected: boolean; declares: boolean }> = [];
  HttpApi.reflect(api, {
    onGroup: () => {},
    onEndpoint: ({ group, endpoint, middleware }) => {
      endpoints.push({
        name: `${group.identifier}.${endpoint.identifier}`,
        isProtected: [...middleware].some(({ key }) => key === Authentication.key),
        declares: Context.getOption(endpoint.annotations, RequiredPermission)._tag === "Some",
      });
    },
  });
  return endpoints;
};

describe("Api", () => {
  it("declares the Permission of every endpoint behind Authentication", () => {
    const undeclared = endpointsOf(Api)
      .filter(({ isProtected, declares }) => isProtected && !declares)
      .map(({ name }) => name);

    expect(undeclared).toEqual([]);
  });

  it("declares no Permission on a public endpoint, which no Permission could guard", () => {
    const declaredPublic = endpointsOf(Api)
      .filter(({ isProtected, declares }) => !isProtected && declares)
      .map(({ name }) => name);

    expect(declaredPublic).toEqual([]);
  });
});

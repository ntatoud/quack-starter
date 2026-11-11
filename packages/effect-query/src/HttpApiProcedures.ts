import { Effect, type ManagedRuntime } from "effect";
import type { HttpApi, HttpApiClient, HttpApiEndpoint, HttpApiGroup } from "effect/http-api";

import { makeProcedure, type Procedure, type ProcedureKey } from "#/Procedure.ts";

type EndpointProcedure<Endpoint extends HttpApiEndpoint.ConstraintRequest, ER> =
  HttpApiClient.Client.MethodReturn<
    Endpoint,
    never,
    never,
    "decoded-only",
    never
  > extends Effect.Effect<infer A, infer E, infer _R>
    ? Procedure<
        HttpApiEndpoint.ClientRequest<
          Endpoint["~Params"],
          Endpoint["~Query"],
          Endpoint["~Payload"],
          Endpoint["~Headers"],
          "decoded-only"
        >,
        A,
        E | ER
      >
    : never;

type GroupProcedures<Group extends HttpApiGroup.Constraint, ER> = {
  /** Matches every query of the group: `invalidateQueries({ queryKey: api.todos.key() })`. */
  readonly key: () => ProcedureKey;
} & (Group["endpoints"] extends infer Endpoints extends Readonly<
  Record<string, HttpApiEndpoint.ConstraintRequest>
>
  ? { readonly [Name in keyof Endpoints]: EndpointProcedure<Endpoints[Name], ER> }
  : {});

/** Mirrors the shape of `HttpApiClient.Client`: one `Procedure` per endpoint. */
export type HttpApiProcedures<Groups extends HttpApiGroup.Constraint, ER = never> = {
  readonly [
    Group in Extract<Groups, { readonly topLevel: false }> as HttpApiGroup.Identifier<Group>
  ]: GroupProcedures<Group, ER>;
} & {
  readonly [
    Endpoint in Extract<
      HttpApiGroup.Endpoints<Extract<Groups, { readonly topLevel: true }>>,
      HttpApiEndpoint.ConstraintRequest
    > as Endpoint["identifier"]
  ]: EndpointProcedure<Endpoint, ER>;
};

/** `Groups` is only a constraint; at runtime every group carries its top-level flag. */
interface RuntimeGroup extends HttpApiGroup.Constraint {
  readonly topLevel: boolean;
}

type AnyCall = (input: unknown) => Effect.Effect<unknown, unknown>;

/**
 * Derives TanStack Query options from an `HttpApi`: `api.todos.list.queryOptions()`,
 * `api.todos.create.mutationOptions()`, `api.todos.key()`.
 *
 * @param options.client The typed client, read from the runtime on every call.
 * @param options.runtime Runs the calls. Dispose it to release the client.
 */
export const makeHttpApiProcedures = <
  ApiId extends string,
  Groups extends HttpApiGroup.Constraint,
  R,
  ER,
>(
  api: HttpApi.HttpApi<ApiId, Groups>,
  options: {
    readonly client: Effect.Effect<HttpApiClient.Client<Groups>, never, R>;
    readonly runtime: ManagedRuntime.ManagedRuntime<R, ER>;
  },
): HttpApiProcedures<Groups, ER> => {
  const root: Record<string, unknown> = {};

  for (const group of Object.values(api.groups) as ReadonlyArray<RuntimeGroup>) {
    const groupPath = group.topLevel ? [] : [group.identifier];
    const node: Record<string, unknown> = group.topLevel ? root : { key: () => [groupPath] };
    if (!group.topLevel) root[group.identifier] = node;

    for (const name of Object.keys(group.endpoints)) {
      if (name in node) {
        throw new Error(`Endpoint "${[...groupPath, name].join(".")}" collides with another key.`);
      }
      const path = [...groupPath, name];
      node[name] = makeProcedure(
        path,
        (input: unknown) =>
          Effect.flatMap(options.client, (client) => {
            // The client nests its methods exactly like the path.
            const call = path.reduce<unknown>(
              (target, key) => (target as Record<string, unknown>)[key],
              client,
            );
            return (call as AnyCall)(input);
          }),
        (effect, runOptions) => options.runtime.runPromiseExit(effect, runOptions),
      );
    }
  }

  return root as HttpApiProcedures<Groups, ER>;
};

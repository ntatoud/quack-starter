import type {
  DataTag,
  QueryFunction,
  UseMutationOptions,
  UseQueryOptions,
} from "@tanstack/react-query";
import { Cause, type Effect, Exit, Option } from "effect";

type OperationType = "query" | "mutation";

/**
 * `[path, { type, input }]`. TanStack Query matches keys partially, so a shorter path or a
 * missing `type` or `input` matches every cache entry below it.
 */
export type ProcedureKey = readonly [
  path: ReadonlyArray<string>,
  options?: { readonly type?: OperationType; readonly input?: unknown },
];

/** Runs an Effect to an Exit. `ManagedRuntime.runPromiseExit` has this shape. */
export type Run<R, ER> = <A, E>(
  effect: Effect.Effect<A, E, R>,
  options?: { readonly signal?: AbortSignal },
) => Promise<Exit.Exit<A, E | ER>>;

type QueryKeyOf<A, E> = DataTag<ProcedureKey, A, E>;

type QueryOverrides<A, E> = Omit<
  UseQueryOptions<A, E, A, QueryKeyOf<A, E>>,
  "queryKey" | "queryFn"
>;

type QueryArgs<Input, A, E> = QueryOverrides<A, E> &
  (void extends Input ? { readonly input?: Input } : { readonly input: Input });

/** One remote call, ready for `useQuery` or `useMutation`. */
export interface Procedure<Input, A, E> {
  /** `key()` matches every operation of this procedure, `key({ type, input })` narrows it. */
  readonly key: (options?: {
    readonly type?: OperationType;
    readonly input?: Input;
  }) => ProcedureKey;

  /** Options for `useQuery` and `useSuspenseQuery`. `input` is the request. */
  readonly queryOptions: (
    ...args: void extends Input
      ? [options?: QueryArgs<Input, A, E>]
      : [options: QueryArgs<Input, A, E>]
  ) => QueryOverrides<A, E> & {
    readonly queryKey: QueryKeyOf<A, E>;
    readonly queryFn: QueryFunction<A, QueryKeyOf<A, E>>;
  };

  /** Options for `useMutation`. The mutation variables are the request. */
  readonly mutationOptions: <TOnMutateResult = unknown>(
    overrides?: Omit<
      UseMutationOptions<A, E, Input, TOnMutateResult>,
      "mutationKey" | "mutationFn"
    >,
  ) => UseMutationOptions<A, E, Input, TOnMutateResult>;
}

/** Resolves with the success, rejects with the typed failure so TanStack Query exposes it as `error`. */
const unwrap = <A, E>(exit: Exit.Exit<A, E>): A => {
  if (Exit.isSuccess(exit)) return exit.value;
  const error = Cause.findErrorOption(exit.cause);
  throw Option.isSome(error) ? error.value : Cause.squash(exit.cause);
};

const makeKey = (
  path: ReadonlyArray<string>,
  type: OperationType | undefined,
  input: unknown,
): ProcedureKey => {
  if (type === undefined && input === undefined) return [path];
  return [path, { ...(type && { type }), ...(input !== undefined && { input }) }];
};

/**
 * Wraps an Effect-returning function for TanStack Query.
 *
 * @param path Where the procedure lives, such as `["todos", "list"]`. It prefixes every key.
 */
export const makeProcedure = <Input, A, E, R, ER>(
  path: ReadonlyArray<string>,
  effect: (input: Input) => Effect.Effect<A, E, R>,
  run: Run<R, ER>,
): Procedure<Input, A, E | ER> => {
  // Written against the widest argument: the conditional tuple of `Procedure` does not resolve
  // while `Input` is generic.
  const queryOptions = (options?: QueryOverrides<A, E | ER> & { readonly input?: Input }) => {
    const { input, ...overrides } = options ?? {};
    return {
      ...overrides,
      queryKey: makeKey(path, "query", input) as QueryKeyOf<A, E | ER>,
      // A cancelled query interrupts the Effect, which aborts the request.
      queryFn: ({ signal }: { readonly signal: AbortSignal }) =>
        run(effect(input as Input), { signal }).then(unwrap),
    };
  };

  return {
    key: (options) => makeKey(path, options?.type, options?.input),
    queryOptions: queryOptions as Procedure<Input, A, E | ER>["queryOptions"],
    mutationOptions: (overrides) => ({
      ...overrides,
      mutationKey: makeKey(path, "mutation", undefined),
      mutationFn: (input) => run(effect(input)).then(unwrap),
    }),
  };
};

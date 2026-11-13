import type {
  DataTag,
  QueryFunction,
  UseMutationOptions,
  UseQueryOptions,
} from "@tanstack/react-query";
import { Cause, type Effect, Exit, Option } from "effect";

type OperationType = "query" | "mutation";

/** TanStack Query matches keys partially: a shorter path, or no `type` or `input`, matches every entry below it. */
export type ProcedureKey = readonly [
  path: ReadonlyArray<string>,
  options?: { readonly type?: OperationType; readonly input?: unknown },
];

/** The shape of `ManagedRuntime.runPromiseExit`. */
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

export interface Procedure<Input, A, E> {
  readonly key: (options?: {
    readonly type?: OperationType;
    readonly input?: Input;
  }) => ProcedureKey;

  readonly queryOptions: (
    ...args: void extends Input
      ? [options?: QueryArgs<Input, A, E>]
      : [options: QueryArgs<Input, A, E>]
  ) => QueryOverrides<A, E> & {
    readonly queryKey: QueryKeyOf<A, E>;
    readonly queryFn: QueryFunction<A, QueryKeyOf<A, E>>;
  };

  readonly mutationOptions: <TOnMutateResult = unknown>(
    overrides?: Omit<
      UseMutationOptions<A, E, Input, TOnMutateResult>,
      "mutationKey" | "mutationFn"
    >,
  ) => UseMutationOptions<A, E, Input, TOnMutateResult>;
}

/** Rejects with the typed failure, so TanStack Query exposes it as `error`. */
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

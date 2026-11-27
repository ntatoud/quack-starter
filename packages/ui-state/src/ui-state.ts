import type { QueryObserverResult } from "@tanstack/react-query";
import { Data, Option } from "effect";

export type UiState<A, E> = Data.TaggedEnum<{
  Idle: {};
  Pending: {};
  Error: { readonly error: E };
  /** A refresh that fails keeps the data already loaded: it shows with the error, not instead of it. */
  Success: { readonly data: A; readonly refreshError: Option.Option<E> };
}>;

interface UiStateDefinition extends Data.TaggedEnum.WithGenerics<2> {
  readonly taggedEnum: UiState<this["A"], this["B"]>;
}

const { Idle, Pending, Error: ErrorState, Success } = Data.taggedEnum<UiStateDefinition>();

export type AnyUiState = UiState<unknown, unknown>;

export type UiStateCases<S extends AnyUiState, Result = unknown> = {
  readonly [Tag in S["_tag"]]: (state: Data.TaggedEnum.Value<S, Tag>) => Result;
};

export type NoExtraCases<S extends AnyUiState, C> = {
  readonly [Tag in Exclude<keyof C, S["_tag"]>]: never;
};

export const UiState = {
  idle: <A = never, E = never>(): Data.TaggedEnum.Value<UiState<A, E>, "Idle"> => Idle(),
  pending: <A = never, E = never>(): Data.TaggedEnum.Value<UiState<A, E>, "Pending"> => Pending(),
  error: <E, A = never>(error: E): Data.TaggedEnum.Value<UiState<A, E>, "Error"> =>
    ErrorState({ error }),
  success: <A, E = never>(
    data: A,
    refreshError: Option.Option<E> = Option.none(),
  ): Data.TaggedEnum.Value<UiState<A, E>, "Success"> => Success({ data, refreshError }),

  /**
   * Takes one case per state the type of `state` can hold, no more, no less: a state left
   * without a case does not compile, and neither does a case for a state that cannot happen.
   */
  match: <S extends AnyUiState, C extends UiStateCases<S>>(
    state: S,
    cases: C & NoExtraCases<S, C>,
  ): ReturnType<C[S["_tag"]]> => {
    const handle = cases[state._tag as S["_tag"]] as (state: S) => ReturnType<C[S["_tag"]]>;

    return handle(state);
  },
};

/** A query starts loading as soon as it exists, so it is never Idle. */
export type QueryUiState<A, E> = Exclude<UiState<A, E>, { readonly _tag: "Idle" }>;

const fromQuery = <A, E>(result: QueryObserverResult<A, E>): QueryUiState<A, E> => {
  if (result.isPending) return UiState.pending();

  if (result.isLoadingError) return UiState.error(result.error);

  return UiState.success(
    result.data,
    result.isRefetchError ? Option.some(result.error) : Option.none(),
  );
};

export const matchQuery = <A, E, C extends UiStateCases<QueryUiState<A, E>>>(
  result: QueryObserverResult<A, E>,
  cases: C & NoExtraCases<QueryUiState<A, E>, C>,
) => UiState.match(fromQuery(result), cases);

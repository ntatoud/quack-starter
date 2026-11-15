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

type AnyUiState = UiState<unknown, unknown>;

type Variant<A, E, Tag extends UiState<A, E>["_tag"]> = Extract<
  UiState<A, E>,
  { readonly _tag: Tag }
>;

export type UiStateCases<S extends AnyUiState> = {
  readonly [Tag in S["_tag"]]: (state: Extract<S, { readonly _tag: Tag }>) => unknown;
};

export type NoExtraCases<S extends AnyUiState, C> = {
  readonly [Tag in Exclude<keyof C, S["_tag"]>]: never;
};

export const UiState = {
  idle: <A = never, E = never>(): Variant<A, E, "Idle"> => Idle(),
  pending: <A = never, E = never>(): Variant<A, E, "Pending"> => Pending(),
  error: <E, A = never>(error: E): Variant<A, E, "Error"> => ErrorState({ error }),
  success: <A, E = never>(
    data: A,
    refreshError: Option.Option<E> = Option.none(),
  ): Variant<A, E, "Success"> => Success({ data, refreshError }),

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

import type { QueryObserverResult } from "@tanstack/react-query";
import { type NoExtraCases, UiState, type UiStateCases } from "#/ui-state.ts";
import { Option } from "effect";

/** A query starts loading as soon as it exists, so it is never Idle. */
export type QueryUiState<A, E> = Exclude<UiState<A, E>, { readonly _tag: "Idle" }>;

export const fromQuery = <A, E>(result: QueryObserverResult<A, E>): QueryUiState<A, E> => {
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

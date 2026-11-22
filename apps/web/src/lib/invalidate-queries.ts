import type { MutationFunctionContext, QueryKey } from "@tanstack/react-query";

export type SettledArguments = [
  data: unknown,
  error: unknown,
  input: unknown,
  onMutateResult: unknown,
  context: MutationFunctionContext,
];

/** Settled or failed, what the mutation touched may have changed: its queries refetch. */
export const invalidating = (queryKey: QueryKey) => ({
  onSettled: (...[, , , , { client }]: SettledArguments) => client.invalidateQueries({ queryKey }),
});

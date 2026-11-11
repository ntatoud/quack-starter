import type { MutationFunctionContext } from "@tanstack/react-query";

import { api } from "#/lib/api.ts";

/** Every todos mutation changes the list, so each one refetches the todos queries, even after a failure. */
export const invalidateTodos = {
  onSettled: (
    _data: unknown,
    _error: unknown,
    _input: unknown,
    _onMutateResult: unknown,
    { client }: MutationFunctionContext,
  ) => client.invalidateQueries({ queryKey: api.todos.key() }),
};

import type { MutationFunctionContext } from "@tanstack/react-query";

import { api } from "#/lib/api.ts";

export const invalidateUsers = {
  onSettled: (
    _data: unknown,
    _error: unknown,
    _input: unknown,
    _onMutateResult: unknown,
    { client }: MutationFunctionContext,
  ) => client.invalidateQueries({ queryKey: api.users.key() }),
};

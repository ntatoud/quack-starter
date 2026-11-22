import { api } from "#/lib/api.ts";
import { invalidating } from "#/lib/invalidate-queries.ts";

export const invalidateTodos = invalidating(api.todos.key());

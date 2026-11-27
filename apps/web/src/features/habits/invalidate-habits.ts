import { api } from "#/lib/api.ts";
import { invalidating } from "#/lib/invalidate-queries.ts";

export const invalidateHabits = invalidating(api.habits.key());

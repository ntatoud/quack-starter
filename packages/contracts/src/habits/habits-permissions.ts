import { Schema } from "effect";

/**
 * Checking in is apart from writing, so an AI Client may check in for a User and never change a Habit.
 * Deleting a Habit deletes its Check-ins, which the User cannot get back.
 */
export const HabitsPermission = Schema.Literals([
  "habits:read",
  "habits:check-in",
  "habits:write",
  "habits:delete",
]);

export type HabitsPermission = typeof HabitsPermission.Type;

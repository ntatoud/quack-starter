import { HttpApiEndpoint, HttpApiGroup, HttpApiSchema, OpenApi } from "effect/http-api";

import { CheckIn, CheckInEntry, Today } from "#/habits/check-in.ts";
import { Day } from "#/habits/day.ts";
import { Habit, HabitId, NewHabit } from "#/habits/habit.ts";
import {
  CheckInDayNotAllowed,
  CheckInQuantityRefused,
  HabitNotFound,
} from "#/habits/habit-errors.ts";
import { Authentication } from "#/identity/authentication.ts";
import { RequiredPermission } from "#/permission.ts";

const NotFound = HabitNotFound.pipe(HttpApiSchema.status(404));
const DayNotAllowed = CheckInDayNotAllowed.pipe(HttpApiSchema.status(422));
const QuantityRefused = CheckInQuantityRefused.pipe(HttpApiSchema.status(422));

const checkInParams = { id: HabitId, day: Day };

export class HabitsApi extends HttpApiGroup.make("habits")
  .add(
    HttpApiEndpoint.post("create", "/", {
      payload: NewHabit,
      success: Habit,
    })
      .annotate(
        OpenApi.Description,
        "Creates a Habit, from Today for the Current User, at the end of their order.",
      )
      .annotate(RequiredPermission, "habits:write"),
    HttpApiEndpoint.get("today", "/today", {
      success: Today,
    })
      .annotate(
        OpenApi.Description,
        "Lists the active Habits due on the Current User's Today, in their order, each with its Check-in.",
      )
      .annotate(RequiredPermission, "habits:read"),
    HttpApiEndpoint.put("checkIn", "/:id/check-ins/:day", {
      params: checkInParams,
      payload: CheckInEntry,
      success: CheckIn,
      error: [NotFound, DayNotAllowed, QuantityRefused],
    })
      .annotate(
        OpenApi.Description,
        "Checks in on the Habit for the Day, replacing its Check-in: with the Day's total for a Habit whose Target is a quantity, null for a done one.",
      )
      .annotate(RequiredPermission, "habits:check-in"),
    HttpApiEndpoint.delete("uncheck", "/:id/check-ins/:day", {
      params: checkInParams,
      success: HttpApiSchema.NoContent,
      error: [NotFound, DayNotAllowed],
    })
      .annotate(OpenApi.Description, "Removes the Check-in of the Habit for the Day, if any.")
      .annotate(RequiredPermission, "habits:check-in"),
  )
  .middleware(Authentication)
  .prefix("/habits") {}

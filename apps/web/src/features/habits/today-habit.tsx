import type { Day } from "@quack/contracts/habits/day";
import type { TodayHabit as TodayHabitData } from "@quack/contracts/habits/check-in";
import { Checkbox } from "@quack/ui/components/checkbox";
import { useMutation } from "@tanstack/react-query";

import { checkInMachine } from "#/features/habits/check-in-machine.ts";
import { HabitColorDot } from "#/features/habits/habit-colors.tsx";
import { invalidateHabits } from "#/features/habits/invalidate-habits.ts";
import { api } from "#/lib/api.ts";
import { useFsm } from "#/lib/use-fsm.ts";

export function TodayHabit({
  day,
  entry: { habit, checkIn },
}: {
  day: Day;
  entry: TodayHabitData;
}) {
  const [state, send] = useFsm(checkInMachine);
  // The refetch of Today runs before the machine hears of the answer: the row goes from its own check to the API's
  // with no flicker, and back to the API's after a failure.
  const check = useMutation(api.habits.checkIn.mutationOptions(invalidateHabits));
  const uncheck = useMutation(api.habits.uncheck.mutationOptions(invalidateHabits));

  const settled = {
    onSuccess: () => send({ type: "succeeded" }),
    onError: () => send({ type: "failed" }),
  };

  const params = { id: habit.id, day };

  const checked =
    state.value === "checking" ? true : state.value === "unchecking" ? false : checkIn !== null;

  return (
    <li className="flex items-center gap-3 py-3 pr-3 pl-5">
      <Checkbox
        checked={checked}
        onCheckedChange={(next) => {
          if (next) {
            if (send({ type: "check" })) check.mutate({ params }, settled);
          } else if (send({ type: "uncheck" })) {
            uncheck.mutate({ params }, settled);
          }
        }}
        aria-label={`Check in ${habit.name}`}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="flex items-center gap-2 text-sm wrap-anywhere">
          <HabitColorDot color={habit.color} />
          {habit.name}
        </span>
        {state.value === "failed" && (
          <span role="alert" className="text-sm text-destructive">
            {state.context.failedTo === "check"
              ? `Could not check in ${habit.name}. Try again.`
              : `Could not uncheck ${habit.name}. Try again.`}
          </span>
        )}
      </div>
    </li>
  );
}

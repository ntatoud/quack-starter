import type { TodayHabit } from "@quack/contracts/habits/check-in";
import type { Day } from "@quack/contracts/habits/day";
import { Quantity } from "@quack/contracts/habits/habit";
import { Button } from "@quack/ui/components/button";
import { Checkbox } from "@quack/ui/components/checkbox";
import { Input } from "@quack/ui/components/input";
import { useMutation } from "@tanstack/react-query";
import { Option, Schema } from "effect";
import { MinusIcon, PlusIcon } from "lucide-react";
import { useState } from "react";

import { checkInMachine } from "#/features/habits/check-in-machine.ts";
import { HabitColorDot } from "#/features/habits/habit-colors.tsx";
import { describeTarget, type QuantityTarget, targetOn } from "#/features/habits/habit-target.ts";
import { invalidateHabits } from "#/features/habits/invalidate-habits.ts";
import { api } from "#/lib/api.ts";
import { useFsm } from "#/lib/use-fsm.ts";

const decodeQuantity = Schema.decodeUnknownOption(Quantity);

// An input of type number gives "" for anything it cannot read as a number.
const typedQuantity = (typed: string) =>
  /^\d+$/.test(typed) ? decodeQuantity(Number(typed)) : Option.none();

/** The Habit's Check-in on the Day through `checkInMachine`: what the row shows, and the requests that change it. */
const useCheckIn = ({ day, due: { habit, checkIn } }: { day: Day; due: TodayHabit }) => {
  const [state, send] = useFsm(checkInMachine);
  // The refetch of Today runs before the machine hears of the answer: the row goes from its own Check-in to the
  // API's with no flicker, and back to the API's after a failure.
  const save = useMutation(api.habits.checkIn.mutationOptions(invalidateHabits));
  const remove = useMutation(api.habits.uncheck.mutationOptions(invalidateHabits));

  const settled = {
    onSuccess: () => send({ type: "succeeded" }),
    onError: () => send({ type: "failed" }),
  };

  const params = { id: habit.id, day };

  return {
    state,
    checkedIn:
      state.value === "checking" ? true : state.value === "unchecking" ? false : checkIn !== null,
    quantity:
      state.value === "checking"
        ? state.context.quantity
        : state.value === "unchecking"
          ? null
          : (checkIn?.quantity ?? null),
    check: (quantity: number | null) => {
      if (send({ type: "check", quantity }))
        save.mutate({ params, payload: { quantity } }, settled);
    },
    uncheck: () => {
      if (send({ type: "uncheck" })) remove.mutate({ params }, settled);
    },
  };
};

export function TodayHabitRow({ day, due }: { day: Day; due: TodayHabit }) {
  const checkIn = useCheckIn({ day, due });
  const { habit } = due;
  const target = targetOn(habit, day);
  const { state } = checkIn;

  return (
    <li className="flex items-center gap-3 py-3 pr-3 pl-5">
      {target._tag === "Done" && (
        <Checkbox
          checked={checkIn.checkedIn}
          onCheckedChange={(next) => (next ? checkIn.check(null) : checkIn.uncheck())}
          aria-label={`Check in ${habit.name}`}
        />
      )}
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="flex items-center gap-2 text-sm wrap-anywhere">
          <HabitColorDot color={habit.color} />
          {habit.name}
        </span>
        {target._tag !== "Done" && (
          <span className="text-sm text-muted-foreground">{describeTarget(target)}</span>
        )}
        {state.value === "failed" && (
          <span role="alert" className="text-sm text-destructive">
            {target._tag !== "Done"
              ? `Could not save the total of ${habit.name}. Try again.`
              : state.context.failedTo === "check"
                ? `Could not check in ${habit.name}. Try again.`
                : `Could not uncheck ${habit.name}. Try again.`}
          </span>
        )}
      </div>
      {target._tag !== "Done" && (
        <QuantityControls
          name={habit.name}
          target={target}
          quantity={checkIn.quantity}
          onCheck={checkIn.check}
          onUncheck={checkIn.uncheck}
        />
      )}
    </li>
  );
}

function QuantityControls({
  name,
  target,
  quantity,
  onCheck,
  onUncheck,
}: {
  name: string;
  target: QuantityTarget;
  quantity: number | null;
  onCheck: (quantity: number) => void;
  onUncheck: () => void;
}) {
  // What the User types, until they press Enter or leave the input: null shows the Day's total.
  const [typed, setTyped] = useState<string | null>(null);
  const total = quantity ?? 0;

  const commit = () => {
    if (typed === null) return;
    setTyped(null);

    if (typed === "") {
      if (quantity !== null) onUncheck();

      return;
    }

    Option.match(typedQuantity(typed), {
      onNone: () => undefined,
      onSome: (next) => {
        if (next !== quantity) onCheck(next);
      },
    });
  };

  return (
    <div className="flex shrink-0 items-center gap-1">
      <Button
        variant="outline"
        size="icon-sm"
        disabled={total === 0 && quantity !== null}
        onClick={() => onCheck(Math.max(total - 1, 0))}
        aria-label={`Remove 1 from ${name}`}
      >
        <MinusIcon aria-hidden="true" />
      </Button>
      <Input
        type="number"
        inputMode="numeric"
        min={0}
        step={1}
        size="sm"
        className="w-16 text-center"
        placeholder="0"
        value={typed ?? (quantity === null ? "" : String(quantity))}
        onChange={(event) => setTyped(event.currentTarget.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === "Enter") commit();
        }}
        aria-label={`Total of ${name}`}
        aria-description={describeTarget(target)}
      />
      <Button
        variant="outline"
        size="icon-sm"
        onClick={() => onCheck(total + 1)}
        aria-label={`Add 1 to ${name}`}
      >
        <PlusIcon aria-hidden="true" />
      </Button>
    </div>
  );
}

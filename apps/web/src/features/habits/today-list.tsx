import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@quack/ui/components/empty";
import type { TodayHabit } from "@quack/contracts/habits/check-in";
import type { Day } from "@quack/contracts/habits/day";
import { matchQuery } from "@quack/ui-state/query";
import { useQuery } from "@tanstack/react-query";
import { Option } from "effect";
import { CalendarCheckIcon } from "lucide-react";
import { useId } from "react";

import { ListLoading } from "#/components/list-loading.tsx";
import { LoadFailed } from "#/components/load-failed.tsx";
import { RefreshFailed } from "#/components/refresh-failed.tsx";
import { TodayHabitRow } from "#/features/habits/today-habit-row.tsx";
import { api } from "#/lib/api.ts";

function TodayHabits({ day, habits }: { day: Day; habits: ReadonlyArray<TodayHabit> }) {
  return (
    <ul className="divide-y rounded-xl border">
      {habits.map((due) => (
        <TodayHabitRow key={due.habit.id} day={day} due={due} />
      ))}
    </ul>
  );
}

export function TodayList() {
  const today = useQuery(api.habits.today.queryOptions());
  const doneThisWeekId = useId();

  return matchQuery(today, {
    Pending: () => <ListLoading label="Loading today…" />,
    Error: () => (
      <LoadFailed
        title="Could not load today"
        retrying={today.isFetching}
        onRetry={() => today.refetch()}
      />
    ),
    Success: ({ data, refreshError }) => (
      <div className="flex flex-col gap-4">
        {Option.isSome(refreshError) && (
          <RefreshFailed
            message="Could not refresh today."
            retrying={today.isFetching}
            onRetry={() => today.refetch()}
          />
        )}
        {data.habits.length === 0 ? (
          <Empty className="border border-dashed">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <CalendarCheckIcon />
              </EmptyMedia>
              {data.doneThisWeek.length === 0 ? (
                <>
                  <EmptyTitle>Nothing due today</EmptyTitle>
                  <EmptyDescription>Add a habit above to start keeping it.</EmptyDescription>
                </>
              ) : (
                <>
                  <EmptyTitle>Nothing left today</EmptyTitle>
                  <EmptyDescription>Every habit due today is done for the week.</EmptyDescription>
                </>
              )}
            </EmptyHeader>
          </Empty>
        ) : (
          <TodayHabits day={data.day} habits={data.habits} />
        )}
        {data.doneThisWeek.length > 0 && (
          <section aria-labelledby={doneThisWeekId} className="flex flex-col gap-2">
            <h2 id={doneThisWeekId} className="text-sm font-medium">
              Done this week
            </h2>
            <TodayHabits day={data.day} habits={data.doneThisWeek} />
          </section>
        )}
      </div>
    ),
  });
}

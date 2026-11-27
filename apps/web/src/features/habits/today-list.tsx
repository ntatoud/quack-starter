import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@quack/ui/components/empty";
import { matchQuery } from "@quack/ui-state/query";
import { useQuery } from "@tanstack/react-query";
import { Option } from "effect";
import { CalendarCheckIcon } from "lucide-react";

import { ListLoading } from "#/components/list-loading.tsx";
import { LoadFailed } from "#/components/load-failed.tsx";
import { RefreshFailed } from "#/components/refresh-failed.tsx";
import { TodayHabitRow } from "#/features/habits/today-habit-row.tsx";
import { api } from "#/lib/api.ts";

export function TodayList() {
  const today = useQuery(api.habits.today.queryOptions());

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
              <EmptyTitle>Nothing due today</EmptyTitle>
              <EmptyDescription>Add a habit above to start keeping it.</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <ul className="divide-y rounded-xl border">
            {data.habits.map((due) => (
              <TodayHabitRow key={due.habit.id} day={data.day} due={due} />
            ))}
          </ul>
        )}
      </div>
    ),
  });
}

import { useQuery } from "@tanstack/react-query";

import { NewHabitForm } from "#/features/habits/new-habit-form.tsx";
import { TodayList } from "#/features/habits/today-list.tsx";
import { PageContent } from "#/features/layout/page-content.tsx";
import { PageHeader } from "#/features/layout/page-header.tsx";
import { api } from "#/lib/api.ts";

export function TodayPage() {
  const today = useQuery(api.habits.today.queryOptions());

  // A Habit done this week counts for Today once checked in on it, as an extra.
  const due = [
    ...(today.data?.habits ?? []),
    ...(today.data?.doneThisWeek ?? []).filter(({ checkIn }) => checkIn !== null),
  ];

  const done = due.filter(({ checkIn }) => checkIn !== null).length;

  return (
    <>
      <PageHeader title="Today">
        {due.length > 0 && (
          <span className="shrink-0 text-sm text-muted-foreground tabular-nums">
            {done} of {due.length} done
          </span>
        )}
      </PageHeader>
      <PageContent className="max-w-2xl">
        <NewHabitForm />
        <TodayList />
      </PageContent>
    </>
  );
}

import { schemaFormOptions } from "@quack/form/schema-form-options";
import { SubmitFailed } from "@quack/form/submit-failed";
import { useAppForm } from "@quack/form/use-app-form";
import { useMutation } from "@tanstack/react-query";

import { habitColorOptions } from "#/features/habits/habit-colors.tsx";
import { HabitDraft, newHabitOf } from "#/features/habits/habit-draft.ts";
import { invalidateHabits } from "#/features/habits/invalidate-habits.ts";
import { api } from "#/lib/api.ts";

const emptyHabitDraft: typeof HabitDraft.Encoded = {
  name: "",
  color: "",
  schedule: "EveryDay",
  days: [],
  times: "3",
};

const scheduleOptions = [
  { value: "EveryDay", label: "Every day" },
  { value: "Weekdays", label: "Some days of the week" },
  { value: "Weekly", label: "A number of times a week" },
];

const weekdayOptions = [
  { value: "1", label: "Monday", short: "M" },
  { value: "2", label: "Tuesday", short: "T" },
  { value: "3", label: "Wednesday", short: "W" },
  { value: "4", label: "Thursday", short: "T" },
  { value: "5", label: "Friday", short: "F" },
  { value: "6", label: "Saturday", short: "S" },
  { value: "7", label: "Sunday", short: "S" },
];

const timesOptions = Array.from({ length: 7 }, (_, index) => ({
  value: `${index + 1}`,
  label: index === 0 ? "1 time a week" : `${index + 1} times a week`,
}));

export function NewHabitForm() {
  const createHabit = useMutation(api.habits.create.mutationOptions(invalidateHabits));

  const form = useAppForm({
    ...schemaFormOptions(HabitDraft, emptyHabitDraft),
    onSubmit: async ({ value, formApi }) => {
      await createHabit.mutateAsync({ payload: newHabitOf(value) }).catch((cause: unknown) => {
        throw new SubmitFailed("Could not add the habit. Try again.", { cause });
      });
      formApi.reset(emptyHabitDraft, { keepDefaultValues: true });
    },
  });

  return (
    <form.AppForm>
      <form.Root className="flex flex-col gap-2">
        <div className="flex flex-wrap items-start gap-2">
          <form.AppField name="name">
            {(field) => (
              <field.Root className="min-w-48 flex-1">
                <field.Label className="sr-only">New habit</field.Label>
                <field.Text placeholder="What do you want to keep doing?" />
              </field.Root>
            )}
          </form.AppField>
          <form.AppField name="color">
            {(field) => (
              <field.Root className="w-36">
                <field.Label className="sr-only">Color</field.Label>
                <field.Select options={habitColorOptions} placeholder="Color" />
              </field.Root>
            )}
          </form.AppField>
          <form.SubmitButton>Add</form.SubmitButton>
        </div>
        <div className="flex flex-wrap items-start gap-2">
          <form.AppField name="schedule">
            {(field) => (
              <field.Root className="w-56">
                <field.Label className="sr-only">Schedule</field.Label>
                <field.Select options={scheduleOptions} />
              </field.Root>
            )}
          </form.AppField>
          <form.Subscribe selector={(state) => state.values.schedule}>
            {(schedule) =>
              schedule === "Weekdays" ? (
                <form.AppField name="days">
                  {(field) => (
                    <field.Root className="w-auto">
                      <field.Label className="sr-only">Days of the week</field.Label>
                      <field.ToggleGroup options={weekdayOptions} />
                    </field.Root>
                  )}
                </form.AppField>
              ) : schedule === "Weekly" ? (
                <form.AppField name="times">
                  {(field) => (
                    <field.Root className="w-44">
                      <field.Label className="sr-only">Times a week</field.Label>
                      <field.Select options={timesOptions} />
                    </field.Root>
                  )}
                </form.AppField>
              ) : null
            }
          </form.Subscribe>
        </div>
        {/* Today is not announced when it changes, so a screen reader hears the success here. */}
        <p role="status" className="sr-only">
          {createHabit.isSuccess && `Added ${createHabit.data.name}`}
        </p>
      </form.Root>
    </form.AppForm>
  );
}

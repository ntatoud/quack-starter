import { schemaFormOptions } from "@quack/form/schema-form-options";
import { SubmitFailed } from "@quack/form/submit-failed";
import { useAppForm } from "@quack/form/use-app-form";
import { useMutation } from "@tanstack/react-query";
import { Schema } from "effect";

import { habitColorOptions } from "#/features/habits/habit-colors.tsx";
import { HabitDraft } from "#/features/habits/habit-draft.ts";
import { invalidateHabits } from "#/features/habits/invalidate-habits.ts";
import { api } from "#/lib/api.ts";

const decodeHabitDraft = Schema.decodeSync(HabitDraft);
const emptyHabitDraft: typeof HabitDraft.Encoded = { name: "", color: "" };

export function NewHabitForm() {
  const createHabit = useMutation(api.habits.create.mutationOptions(invalidateHabits));

  const form = useAppForm({
    ...schemaFormOptions(HabitDraft, emptyHabitDraft),
    onSubmit: async ({ value, formApi }) => {
      await createHabit
        .mutateAsync({
          payload: {
            ...decodeHabitDraft(value),
            schedule: { _tag: "EveryDay" },
            target: { _tag: "Done" },
          },
        })
        .catch((cause: unknown) => {
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
        {/* Today is not announced when it changes, so a screen reader hears the success here. */}
        <p role="status" className="sr-only">
          {createHabit.isSuccess && `Added ${createHabit.data.name}`}
        </p>
      </form.Root>
    </form.AppForm>
  );
}

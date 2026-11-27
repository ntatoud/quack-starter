import { schemaFormOptions } from "@quack/form/schema-form-options";
import { SubmitFailed } from "@quack/form/submit-failed";
import { useAppForm } from "@quack/form/use-app-form";
import { useMutation } from "@tanstack/react-query";
import { Schema } from "effect";

import { habitColorOptions } from "#/features/habits/habit-colors.tsx";
import { HabitDraft, targetOf, targetOptions } from "#/features/habits/habit-draft.ts";
import { invalidateHabits } from "#/features/habits/invalidate-habits.ts";
import { api } from "#/lib/api.ts";

const decodeHabitDraft = Schema.decodeSync(HabitDraft);

const emptyHabitDraft: typeof HabitDraft.Encoded = {
  name: "",
  color: "",
  target: "Done",
  quantity: "",
  unit: "",
};

export function NewHabitForm() {
  const createHabit = useMutation(api.habits.create.mutationOptions(invalidateHabits));

  const form = useAppForm({
    ...schemaFormOptions(HabitDraft, emptyHabitDraft),
    onSubmit: async ({ value, formApi }) => {
      const draft = decodeHabitDraft(value);
      await createHabit
        .mutateAsync({
          payload: {
            name: draft.name,
            color: draft.color,
            schedule: { _tag: "EveryDay" },
            target: targetOf(draft),
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
          <form.AppField name="target">
            {(field) => (
              <field.Root className="w-32">
                <field.Label className="sr-only">Target</field.Label>
                <field.Select options={targetOptions} />
              </field.Root>
            )}
          </form.AppField>
          <form.Subscribe selector={(state) => state.values.target}>
            {(target) =>
              target !== "Done" && (
                <>
                  <form.AppField name="quantity">
                    {(field) => (
                      <field.Root className="w-24">
                        <field.Label className="sr-only">Quantity</field.Label>
                        <field.Text inputMode="numeric" placeholder="Quantity" />
                      </field.Root>
                    )}
                  </form.AppField>
                  <form.AppField name="unit">
                    {(field) => (
                      <field.Root className="w-32">
                        <field.Label className="sr-only">Unit</field.Label>
                        <field.Text placeholder="Unit, like glasses" />
                      </field.Root>
                    )}
                  </form.AppField>
                </>
              )
            }
          </form.Subscribe>
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

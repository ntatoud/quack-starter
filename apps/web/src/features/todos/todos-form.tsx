import { schemaFormOptions } from "@quack/form/schema-form-options";
import { SubmitFailed } from "@quack/form/submit-failed";
import { useAppForm } from "@quack/form/use-app-form";
import { useMutation } from "@tanstack/react-query";
import { Equal, Schema } from "effect";

import { invalidateTodos } from "#/features/todos/invalidate-todos.ts";
import { TodoDraft } from "#/features/todos/todo-draft.ts";
import { api } from "#/lib/api.ts";

const decodeTodoDraft = Schema.decodeSync(TodoDraft);
const emptyTodoDraft: typeof TodoDraft.Encoded = { title: "" };

export function TodosForm() {
  const createTodo = useMutation(api.todos.create.mutationOptions(invalidateTodos));

  const form = useAppForm({
    ...schemaFormOptions(TodoDraft, emptyTodoDraft),
    onSubmit: async ({ value, formApi }) => {
      await createTodo.mutateAsync({ payload: decodeTodoDraft(value) }).catch((cause: unknown) => {
        throw new SubmitFailed("Could not add the todo. Try again.", { cause });
      });
      // Start a new draft: empty, or what was typed while the request was running.
      // The default stays empty: what was typed meanwhile is a value, not the new default.
      const typedMeanwhile = !Equal.equals(formApi.state.values, value);
      formApi.reset(typedMeanwhile ? formApi.state.values : emptyTodoDraft, {
        keepDefaultValues: true,
      });
    },
  });

  return (
    <form.AppForm>
      <form.Root className="flex flex-col gap-2">
        <div className="flex items-start gap-2">
          <form.AppField name="title">
            {(field) => (
              <field.Root>
                <field.Label className="sr-only">New todo</field.Label>
                <field.Text placeholder="What needs doing?" />
              </field.Root>
            )}
          </form.AppField>
          <form.SubmitButton>Add</form.SubmitButton>
        </div>
        {/* The list is not announced when it changes, so a screen reader hears the success here. */}
        <p role="status" className="sr-only">
          {createTodo.isSuccess && `Added ${createTodo.data.title}`}
        </p>
      </form.Root>
    </form.AppForm>
  );
}

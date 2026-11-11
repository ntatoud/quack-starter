import { FieldError } from "@quack/ui/components/field";
import { useStore } from "@tanstack/react-form";
import { type ComponentProps, type FormEvent, useState } from "react";

import { useFormContext } from "#/context.ts";
import { type Message, toMessage } from "#/messages.ts";
import { SubmitFailed } from "#/SubmitFailed.ts";

/**
 * The errors of the form itself. A schema reports every issue of the form by path, and those of the form itself
 * have the empty path. A `SubmitFailed` is stored as its message, a string.
 */
const toFormMessages = (error: unknown): Array<Message | undefined> =>
  typeof error === "object" && error !== null
    ? ((error as Record<string, Array<Message>>)[""] ?? [])
    : [toMessage(error)];

/** Node, where the tests run, has no `reportError`. */
const report = (error: unknown) =>
  typeof reportError === "function" ? reportError(error) : console.error(error);

/**
 * The `<form>` of its `form.AppForm`. It renders the errors of the form itself after its children:
 * the issues of the schema that belong to no field, and the message of a `SubmitFailed`.
 *
 * A failed submit tells a screen reader why, once: it moves the focus to the first element with `aria-invalid`,
 * which describes itself with its error, or it says the errors in a live region when there is nothing to focus.
 * Errors that come and go while the user types are not announced.
 */
export function Form({
  children,
  ...props
}: Omit<ComponentProps<"form">, "onSubmit" | "noValidate">) {
  const form = useFormContext();
  const errors = useStore(form.store, (state) => state.errors).flatMap(toFormMessages);
  const values = useStore(form.store, (state) => state.values);
  // What the live region says, and the values it is about.
  const [announcement, setAnnouncement] = useState({ text: "", values });
  // An edit makes it out of date for good: a reset can bring back the very values it was about.
  if (announcement.text !== "" && announcement.values !== values) {
    setAnnouncement({ text: "", values });
  }

  // Filled a frame after the submit emptied it, so a screen reader sees a change and says the same text again.
  const announce = (messages: ReadonlyArray<Message | undefined>) => {
    const text = messages.flatMap((error) => error?.message ?? []).join(". ");
    requestAnimationFrame(() => setAnnouncement({ text, values: form.state.values }));
  };

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    // The button is unavailable while a submission runs; a script or another control may still submit.
    if (form.state.isSubmitting) return;
    const element = event.currentTarget;
    setAnnouncement({ text: "", values });
    void form.handleSubmit().then(
      () => {
        if (form.state.isSubmitSuccessful) return;
        const invalid = element.querySelector<HTMLElement>('[aria-invalid="true"]');
        if (invalid === null) {
          announce(form.state.errors.flatMap(toFormMessages));
        } else if (invalid !== document.activeElement) {
          invalid.focus();
        } else {
          // Enter was pressed in the field. Focusing the focused element says nothing.
          const fieldMeta: Record<string, { errors: Array<unknown> } | undefined> =
            form.state.fieldMeta;
          announce((fieldMeta[invalid.getAttribute("name") ?? ""]?.errors ?? []).map(toMessage));
        }
      },
      (error: unknown) => {
        if (!(error instanceof SubmitFailed)) return report(error);
        form.setErrorMap({ onServer: error.message });
        announce([error]);
      },
    );
  };

  return (
    // The schema validates, with its own messages, so the browser's validation is off.
    <form {...props} noValidate onSubmit={submit}>
      {children}
      <FieldError role={undefined} errors={errors} />
      <p role="status" className="sr-only">
        {announcement.text}
      </p>
    </form>
  );
}

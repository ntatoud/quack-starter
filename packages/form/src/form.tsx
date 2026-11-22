import { useStore, type ValidationError } from "@tanstack/react-form";
import { type ComponentProps, type FormEvent, useState } from "react";

import { useFormContext } from "#/context.ts";
import { ErrorMessages, ErrorText } from "#/field-control-error.tsx";
import { isIssuesByPath, type Message, toMessage } from "#/messages.ts";
import { SubmitFailed } from "#/submit-failed.ts";

/** The issues of the form itself have the empty path; a `SubmitFailed` is stored as its message. */
const toFormMessages = (error: ValidationError): Array<Message | undefined> =>
  isIssuesByPath(error) ? [...(error[""] ?? [])] : [toMessage(error)];

export function Form({
  children,
  ...props
}: Omit<ComponentProps<"form">, "onSubmit" | "noValidate">) {
  const form = useFormContext();
  const errors = useStore(form.store, (state) => state.errors).flatMap(toFormMessages);
  const values = useStore(form.store, (state) => state.values);
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
      (error) => {
        if (!(error instanceof SubmitFailed)) return reportError(error);
        form.setErrorMap({ onServer: error.message });
        announce([error]);
      },
    );
  };

  return (
    // The schema validates, with its own messages, so the browser's validation is off.
    <form {...props} noValidate onSubmit={submit}>
      {children}
      {errors.length > 0 && (
        <ErrorText>
          <ErrorMessages errors={errors} />
        </ErrorText>
      )}
      <p role="status" className="sr-only">
        {announcement.text}
      </p>
    </form>
  );
}

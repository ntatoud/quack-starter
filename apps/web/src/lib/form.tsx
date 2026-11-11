import { Button } from "@quack/ui/components/button";
import { Field, FieldError, FieldLabel } from "@quack/ui/components/field";
import { Input } from "@quack/ui/components/input";
import { cn } from "@quack/ui/lib/utils";
import {
  createFormHook,
  createFormHookContexts,
  formOptions,
  revalidateLogic,
  type StandardSchemaV1,
  useStore,
} from "@tanstack/react-form";
import { Schema } from "effect";
import { type ComponentProps, type FormEvent, useId, useState } from "react";

const { fieldContext, formContext, useFieldContext, useFormContext } = createFormHookContexts();

/** The sizes every field and form component takes. An input and a button of one size line up. */
type Size = "sm" | "md" | "lg";

const textSize = { sm: "text-[0.8rem]", md: "text-sm", lg: "text-sm" } satisfies Record<
  Size,
  string
>;
const buttonSize = { sm: "sm", md: "default", lg: "lg" } as const satisfies Record<Size, string>;

type Message = { message?: string };

/** Schema validators report issues; function validators may return a plain string. */
const toMessage = (error: unknown): Message | undefined =>
  typeof error === "string" ? { message: error } : (error as Message | undefined);

/**
 * The errors of the form itself. A schema reports every issue of the form by path, and those of the form itself
 * have the empty path. A `SubmitFailed` is stored as its message, a string.
 */
const toFormMessages = (error: unknown): Array<Message | undefined> =>
  typeof error === "object" && error !== null
    ? ((error as Record<string, Array<Message>>)[""] ?? [])
    : [toMessage(error)];

/**
 * Thrown by `onSubmit` when the submission fails, for example when its request fails.
 * `form.Form` shows its message until the next edit. Any other error thrown by `onSubmit` is a bug and is reported.
 */
export class SubmitFailed extends Error {
  override readonly name = "SubmitFailed";
}

/** Node, where the tests run, has no `reportError`. */
const report = (error: unknown) =>
  typeof reportError === "function" ? reportError(error) : console.error(error);

/**
 * A text input bound to the field of its `form.AppField`, with its label and errors.
 * Errors show once the field is touched; a submit touches every field.
 */
function TextField({
  label,
  hideLabel = false,
  size = "md",
  ...props
}: { label: string; hideLabel?: boolean; size?: Size } & Omit<
  ComponentProps<typeof Input>,
  | "id"
  | "name"
  | "size"
  | "value"
  | "defaultValue"
  | "onChange"
  | "onBlur"
  | "aria-invalid"
  | "aria-describedby"
>) {
  const field = useFieldContext<string>();
  const meta = useStore(field.store, (state) => state.meta);
  // Not the field name: two forms on one page may both have a `title`.
  const id = useId();
  const errorId = `${id}-error`;
  const invalid = meta.isTouched && !meta.isValid;

  return (
    // One labelled input is not a group.
    <Field role={undefined} data-invalid={invalid}>
      <FieldLabel htmlFor={id} className={hideLabel ? "sr-only" : textSize[size]}>
        {label}
      </FieldLabel>
      <Input
        {...props}
        id={id}
        name={field.name}
        size={size}
        value={field.state.value}
        onChange={(event) => field.handleChange(event.target.value)}
        onBlur={field.handleBlur}
        // `Form` finds the invalid field by `aria-invalid`, and its errors by `name`.
        aria-invalid={invalid}
        aria-describedby={invalid ? errorId : undefined}
      />
      {invalid && (
        // Not an alert: the input describes itself with the error, and an alert would interrupt typing.
        <FieldError
          id={errorId}
          role={undefined}
          className={textSize[size]}
          errors={meta.errors.map(toMessage)}
        />
      )}
    </Field>
  );
}

/**
 * The `<form>` of its `form.AppForm`. It renders the errors of the form itself after its children:
 * the issues of the schema that belong to no field, and the message of a `SubmitFailed`.
 *
 * A failed submit tells a screen reader why, once: it moves the focus to the first element with `aria-invalid`,
 * which describes itself with its error, or it says the errors in a live region when there is nothing to focus.
 * Errors that come and go while the user types are not announced.
 */
function Form({ children, ...props }: Omit<ComponentProps<"form">, "onSubmit" | "noValidate">) {
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

/**
 * The submit button of its `form.AppForm`, unavailable while the form is submitting.
 * It keeps the focus then, and it stays enabled while the form is invalid: a disabled button is skipped by the
 * keyboard and explains nothing, a submit shows the errors.
 */
function SubmitButton({
  size = "md",
  className,
  ...props
}: { size?: Size } & Omit<
  ComponentProps<typeof Button>,
  "type" | "size" | "disabled" | "focusableWhenDisabled"
>) {
  const form = useFormContext();
  const isSubmitting = useStore(form.store, (state) => state.isSubmitting);
  return (
    <Button
      {...props}
      // The button's own disabled style needs the `disabled` attribute, which would drop the focus.
      className={cn("aria-disabled:pointer-events-none aria-disabled:opacity-50", className)}
      type="submit"
      size={buttonSize[size]}
      disabled={isSubmitting}
      focusableWhenDisabled
    />
  );
}

/**
 * The app's form hook: `useAppForm` is `useForm` with the components above on `form.AppField`
 * (`field.TextField`) and `form.AppForm` (`form.Form`, `form.SubmitButton`).
 */
export const { useAppForm } = createFormHook({
  fieldContext,
  formContext,
  fieldComponents: { TextField },
  formComponents: { Form, SubmitButton },
});

/**
 * The options of a form validated by an Effect schema: spread them into `useAppForm`.
 * The form validates on submit, then on every change once a submit was attempted.
 * Validation does not transform the values: decode them with the schema in `onSubmit`.
 * An issue of a field shows on the field; an issue of the form itself shows at the end of `form.Form`.
 */
export const schemaFormOptions = <Values, Decoded>(
  schema: Schema.Codec<Decoded, Values>,
  defaultValues: Values,
) => {
  const validator: StandardSchemaV1<Values, Decoded> = Schema.toStandardSchemaV1(schema);
  return formOptions({
    defaultValues,
    validationLogic: revalidateLogic(),
    validators: { onDynamic: validator },
  });
};

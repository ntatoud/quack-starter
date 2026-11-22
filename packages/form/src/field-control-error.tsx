import { fieldErrorClassName } from "@quack/ui/components/field";
import { cn } from "@quack/ui/lib/utils";

import type { ComponentProps } from "react";

import { type Message } from "#/messages.ts";
import { textSize } from "#/size.ts";
import type { useFieldControl } from "#/use-field-control.ts";

export type Control = Pick<
  ReturnType<typeof useFieldControl>,
  "errorId" | "invalid" | "size" | "errors"
>;

/** One message as text, several as a list; the same message twice is said once. */
export function ErrorMessages({ errors }: { errors: ReadonlyArray<Message | undefined> }) {
  const messages = [...new Set(errors.flatMap((error) => error?.message ?? []))];

  if (messages.length === 1) return messages[0];

  return (
    <ul className="ml-4 flex list-disc flex-col gap-1">
      {messages.map((message) => (
        <li key={message}>{message}</li>
      ))}
    </ul>
  );
}

/**
 * Not an alert, and not a `FieldError`: the control describes itself with the error, and `form.Root` says it when the
 * focus does not move. The live region of a `FieldError` would say it a second time.
 */
export function ErrorText({ className, children, ...props }: ComponentProps<"div">) {
  return (
    <div className={cn(fieldErrorClassName, className)} {...props}>
      {children}
    </div>
  );
}

export function FieldControlError({ control }: { control: Control }) {
  const { errorId, invalid, size, errors } = control;

  if (!invalid) return null;

  return (
    <ErrorText id={errorId} className={textSize[size]}>
      <ErrorMessages errors={errors} />
    </ErrorText>
  );
}

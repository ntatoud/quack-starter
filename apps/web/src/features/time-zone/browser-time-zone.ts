import { TimeZone } from "@quack/contracts/identity/user";
import { DateTime, Option, Schema } from "effect";

/** The time zone the browser runs in, or UTC when it names one the contract refuses. */
export const browserTimeZone = (): TimeZone =>
  Schema.decodeOption(TimeZone)(Intl.DateTimeFormat().resolvedOptions().timeZone).pipe(
    Option.getOrElse(() => DateTime.zoneMakeNamedUnsafe("UTC")),
  );

import { Schema } from "effect";
import { HttpApiEndpoint, HttpApiGroup, HttpApiSchema } from "effect/http-api";

import { Authentication } from "#/identity/authentication.ts";
import {
  EmailAlreadyTaken,
  ExpiredLink,
  InvalidCredentials,
  TooManyAttempts,
  WrongPassword,
} from "#/identity/identity-errors.ts";
import { Email, Me, Password, TimeZone, User } from "#/identity/user.ts";
import { RequiredPermission } from "#/permission.ts";

/** What a visitor types to sign up or in. A password no User can have is refused before it is checked. */
export const Credentials = Schema.Struct({ email: Email, password: Password });

export const SignInPayload = Credentials;

/** The time zone is the browser's: the User changes it later in the settings. */
export const SignUpPayload = Schema.Struct({ ...Credentials.fields, timeZone: TimeZone });

export const PasswordResetRequestPayload = Schema.Struct({ email: Email });

export const PasswordResetConfirmPayload = Schema.Struct({
  token: Schema.NonEmptyString,
  password: Password,
});

/** The current password proves that whoever holds the Session is the User. */
export const EmailChangeRequestPayload = Schema.Struct({ newEmail: Email, password: Password });

export const EmailChangeConfirmPayload = Schema.Struct({ token: Schema.NonEmptyString });

export class IdentityApi extends HttpApiGroup.make("identity").add(
  HttpApiEndpoint.post("signUp", "/sign-up", {
    payload: SignUpPayload,
    success: User,
    error: [
      EmailAlreadyTaken.pipe(HttpApiSchema.status(409)),
      TooManyAttempts.pipe(HttpApiSchema.status(429)),
    ],
  }),
  HttpApiEndpoint.post("signIn", "/sign-in", {
    payload: SignInPayload,
    success: User,
    error: [
      InvalidCredentials.pipe(HttpApiSchema.status(401)),
      TooManyAttempts.pipe(HttpApiSchema.status(429)),
    ],
  }),
  HttpApiEndpoint.post("signOut", "/sign-out"),
  /** Accepted whether a User has the email or not, so the answer says nothing of it. */
  HttpApiEndpoint.post("requestPasswordReset", "/password-reset", {
    payload: PasswordResetRequestPayload,
    success: HttpApiSchema.Accepted,
    error: TooManyAttempts.pipe(HttpApiSchema.status(429)),
  }),
  /** Sets the new password and ends every Session of the User, without signing them in. */
  HttpApiEndpoint.post("confirmPasswordReset", "/password-reset/confirm", {
    payload: PasswordResetConfirmPayload,
    error: ExpiredLink.pipe(HttpApiSchema.status(410)),
  }),
  /**
   * Makes the new email the User's, and keeps their Sessions. Needs no Session: the token, mailed to the new email,
   * is the proof.
   */
  HttpApiEndpoint.post("confirmEmailChange", "/email-change/confirm", {
    payload: EmailChangeConfirmPayload,
    error: [
      ExpiredLink.pipe(HttpApiSchema.status(410)),
      EmailAlreadyTaken.pipe(HttpApiSchema.status(409)),
    ],
  }),
  HttpApiEndpoint.get("me", "/me", {
    success: Me,
  })
    .annotate(RequiredPermission, "none")
    .middleware(Authentication),
  /**
   * Mails a link to the new email, in place of any earlier one, and a notice to the current one. The email stays
   * the same until the link is opened.
   */
  HttpApiEndpoint.post("requestEmailChange", "/me/email-change", {
    payload: EmailChangeRequestPayload,
    success: HttpApiSchema.Accepted,
    error: [
      WrongPassword.pipe(HttpApiSchema.status(400)),
      EmailAlreadyTaken.pipe(HttpApiSchema.status(409)),
      TooManyAttempts.pipe(HttpApiSchema.status(429)),
    ],
  })
    .annotate(RequiredPermission, "none")
    .middleware(Authentication),
  /** The link of the pending Email Change stops working. */
  HttpApiEndpoint.delete("cancelEmailChange", "/me/email-change")
    .annotate(RequiredPermission, "none")
    .middleware(Authentication),
) {}

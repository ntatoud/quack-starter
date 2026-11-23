import { Schema, SchemaTransformation } from "effect";
import { HttpApiEndpoint, HttpApiGroup, HttpApiSchema } from "effect/http-api";

import { Authentication } from "#/identity/authentication.ts";
import {
  EmailAlreadyTaken,
  ExpiredLink,
  InvalidCredentials,
  TooManyAttempts,
  Unauthenticated,
} from "#/identity/identity-errors.ts";
import { PersonName, Profile } from "#/identity/profile.ts";
import { Email, Password, TimeZone, User } from "#/identity/user.ts";
import { RequiredPermission } from "#/permission.ts";

/** The time zone is the browser's: the User changes it later in the settings. */
export const SignUpPayload = Schema.Struct({
  email: Email,
  password: Password,
  timeZone: TimeZone,
});

export const TimeZonePayload = Schema.Struct({ timeZone: TimeZone });

/** A password no User can have is refused before it is checked. */
export const SignInPayload = Schema.Struct({ email: Email, password: Password });

export const PasswordResetRequestPayload = Schema.Struct({ email: Email });

export const PasswordResetConfirmPayload = Schema.Struct({
  token: Schema.NonEmptyString,
  password: Password,
});

/** Trims what was typed, then decodes it with `schema`, whose `Schema.Trimmed` would only refuse the spaces. */
const trimmed = <S extends Schema.Codec<string, string>>(schema: S) =>
  Schema.String.pipe(Schema.decodeTo(schema, SchemaTransformation.trim()));

/** What the onboarding asks for: the fields a Profile requires. */
export const OnboardingPayload = Schema.Struct({
  firstName: trimmed(PersonName),
  lastName: trimmed(PersonName),
});

export type OnboardingPayload = typeof OnboardingPayload.Type;

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
  HttpApiEndpoint.get("me", "/me", {
    success: User,
  })
    .annotate(RequiredPermission, "none")
    .middleware(Authentication),
  /** Replaces the whole Profile of the Current User, and answers with their User. */
  HttpApiEndpoint.put("updateProfile", "/me/profile", {
    payload: Profile,
    success: User,
    error: Unauthenticated.pipe(HttpApiSchema.status(401)),
  })
    .annotate(RequiredPermission, "none")
    .middleware(Authentication),
  HttpApiEndpoint.put("updateTimeZone", "/me/time-zone", {
    payload: TimeZonePayload,
    success: User,
    error: Unauthenticated.pipe(HttpApiSchema.status(401)),
  })
    .annotate(RequiredPermission, "none")
    .middleware(Authentication),
  HttpApiEndpoint.post("completeOnboarding", "/me/onboarding", {
    payload: OnboardingPayload,
    success: User,
    error: Unauthenticated.pipe(HttpApiSchema.status(401)),
  })
    .annotate(RequiredPermission, "none")
    .middleware(Authentication),
) {}

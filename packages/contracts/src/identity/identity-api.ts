import { Schema, SchemaTransformation } from "effect";
import { HttpApiEndpoint, HttpApiGroup, HttpApiSchema } from "effect/http-api";

import { Authentication } from "#/identity/authentication.ts";
import {
  EmailAlreadyTaken,
  InvalidCredentials,
  TooManyAttempts,
  Unauthenticated,
} from "#/identity/identity-errors.ts";
import { PersonName, Profile } from "#/identity/profile.ts";
import { Email, Password, User } from "#/identity/user.ts";

export const SignUpPayload = Schema.Struct({ email: Email, password: Password });

/** A password no User can have is refused before it is checked. */
export const SignInPayload = Schema.Struct({ email: Email, password: Password });

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
  HttpApiEndpoint.get("me", "/me", {
    success: User,
  }).middleware(Authentication),
  /** Replaces the whole Profile of the Current User, and answers with their User. */
  HttpApiEndpoint.put("updateProfile", "/me/profile", {
    payload: Profile,
    success: User,
    error: Unauthenticated.pipe(HttpApiSchema.status(401)),
  }).middleware(Authentication),
  HttpApiEndpoint.post("completeOnboarding", "/me/onboarding", {
    payload: OnboardingPayload,
    success: User,
    error: Unauthenticated.pipe(HttpApiSchema.status(401)),
  }).middleware(Authentication),
) {}

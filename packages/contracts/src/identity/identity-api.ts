import { Schema } from "effect";
import { HttpApiEndpoint, HttpApiGroup, HttpApiSchema } from "effect/http-api";

import { Authentication } from "#/identity/authentication.ts";
import {
  EmailAlreadyTaken,
  InvalidCredentials,
  TooManyAttempts,
  Unauthenticated,
} from "#/identity/identity-errors.ts";
import { Profile } from "#/identity/profile.ts";
import { Email, Password, User } from "#/identity/user.ts";

export const SignUpPayload = Schema.Struct({ email: Email, password: Password });

/** A password no User can have is refused before it is checked. */
export const SignInPayload = Schema.Struct({ email: Email, password: Password });

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
) {}

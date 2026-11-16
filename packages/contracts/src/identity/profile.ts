import { Schema } from "effect";

export const Team = Schema.Literals([
  "engineering",
  "design",
  "product",
  "sales",
  "marketing",
  "support",
  "operations",
]);
export type Team = typeof Team.Type;

/** ISO 3166-1 alpha-2. */
export const CountryCode = Schema.String.check(
  Schema.isPattern(/^[A-Z]{2}$/, { message: "Enter a country code of two capital letters" }),
).pipe(Schema.brand("CountryCode"));
export type CountryCode = typeof CountryCode.Type;

export const PersonName = Schema.Trimmed.check(
  Schema.isNonEmpty({ message: "Name is required" }),
  Schema.isMaxLength(100, { message: "Name must be at most 100 characters" }),
);

export const Tag = Schema.Trimmed.check(Schema.isNonEmpty(), Schema.isMaxLength(30));

export class Profile extends Schema.Class<Profile, { readonly brand: unique symbol }>("Profile")({
  firstName: PersonName,
  lastName: PersonName,
  avatarUrl: Schema.NullOr(Schema.String),
  jobTitle: Schema.Trimmed.check(Schema.isMaxLength(100)),
  team: Team,
  country: CountryCode,
  tags: Schema.Array(Tag),
}) {}

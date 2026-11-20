import { CountryCode, PersonName, type Profile, Team } from "@quack/contracts/identity/profile";
import { Schema, SchemaTransformation } from "effect";

const EmptyAsNull = Schema.String.pipe(
  Schema.decodeTo(
    Schema.NullOr(Schema.String),
    SchemaTransformation.transform<string | null, string>({
      decode: (text) => (text === "" ? null : text),
      encode: (text) => text ?? "",
    }),
  ),
);

/** What the Profile form holds: text only, trimmed first, since surrounding whitespace is not a mistake to report. */
export const ProfileDraft = Schema.Struct({
  firstName: Schema.Trim.pipe(Schema.decodeTo(PersonName)),
  lastName: Schema.Trim.pipe(Schema.decodeTo(PersonName)),
  jobTitle: Schema.Trim.pipe(
    Schema.decodeTo(
      Schema.Trimmed.check(
        Schema.isMaxLength(100, { message: "Job title must be at most 100 characters" }),
      ),
    ),
  ),
  team: EmptyAsNull.pipe(Schema.decodeTo(Schema.NullOr(Team))),
  country: EmptyAsNull.pipe(Schema.decodeTo(Schema.NullOr(CountryCode))),
  avatarUrl: Schema.Trim.pipe(Schema.decodeTo(EmptyAsNull)),
});

const emptyProfileDraft: typeof ProfileDraft.Encoded = {
  firstName: "",
  lastName: "",
  jobTitle: "",
  team: "",
  country: "",
  avatarUrl: "",
};

export const profileDraftOf = (
  profile: typeof Profile.Encoded | null,
): typeof ProfileDraft.Encoded =>
  profile === null
    ? emptyProfileDraft
    : {
        ...profile,
        team: profile.team ?? "",
        country: profile.country ?? "",
        avatarUrl: profile.avatarUrl ?? "",
      };

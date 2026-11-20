import { Option, Predicate, Schema } from "effect";

type AnySchema = Schema.Codec<any, any>;

export interface Preference<S extends AnySchema> {
  readonly schema: S;
  readonly defaultValue: S["Type"];
}

export const definePreference = <S extends AnySchema>(
  schema: S,
  defaultValue: S["Type"],
): Preference<S> => ({ schema, defaultValue });

type PreferenceFields = Readonly<Record<string, Preference<AnySchema>>>;

/** Rejects a key with a capital letter at compile time; the test of the registry checks the rest of kebab-case. */
type LowercaseKeys<F> = { readonly [K in keyof F]: K extends Lowercase<K & string> ? F[K] : never };

type ValueSchemas<F extends PreferenceFields> = { readonly [K in keyof F]: F[K]["schema"] };

export const definePreferences = <const F extends PreferenceFields>(
  fields: F & LowercaseKeys<F>,
) => {
  const keys = Object.keys(fields) as ReadonlyArray<keyof F & string>;
  const mapFields = <R>(f: (preference: Preference<AnySchema>, key: keyof F & string) => R) =>
    Object.fromEntries(keys.map((key) => [key, f(fields[key], key)]));

  const Values = Schema.Struct(mapFields((p) => p.schema) as ValueSchemas<F>);
  type Values = typeof Values.Type;

  return {
    Values,
    defaults: mapFields((p) => p.defaultValue) as Values,
    decodeWithDefaults: (stored: unknown): Values => {
      const record = Predicate.isObject(stored) ? (stored as Record<string, unknown>) : {};
      return mapFields(({ schema, defaultValue }, key) =>
        key in record
          ? Schema.decodeUnknownOption(schema)(record[key]).pipe(
              Option.getOrElse(() => defaultValue),
            )
          : defaultValue,
      ) as Values;
    },
  };
};

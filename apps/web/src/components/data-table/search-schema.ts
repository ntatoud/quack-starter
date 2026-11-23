import { Effect, Schema, SchemaTransformation } from "effect";

// Enough rows for any page a person reads; past it, a URL renders thousands of rows at once.
const maxPageSize = 100;

// A value that does not validate is replaced by `undefined`, not dropped: the router keeps the raw value of a key that
// validation drops. The state then takes its default, in the one form it has.
const orUndefined = <S extends Schema.Top>(schema: S) =>
  Schema.optional(
    Schema.UndefinedOr(schema).pipe(Schema.catchDecoding(() => Effect.succeedSome(undefined))),
  );

// The router parses `?q=42` as a number: it is the search "42". A search of blanks is no search, as the toolbar
// sends it.
const SearchText = Schema.Union([Schema.String, Schema.Finite, Schema.Boolean]).pipe(
  Schema.decodeTo(
    Schema.UndefinedOr(Schema.String),
    SchemaTransformation.transform({
      decode: (value) => {
        const text = String(value);

        return text.trim() === "" ? undefined : text;
      },
      encode: (text) => text ?? "",
    }),
  ),
);

// A filter that needs no service to decode, as `validateSearch` runs without any.
export type DataTableFilterSchemas = Readonly<Record<string, Schema.Decoder<unknown>>>;

type OptionalFilters<Filters extends DataTableFilterSchemas> = {
  readonly [Key in keyof Filters]: ReturnType<typeof orUndefined<Filters[Key]>>;
};

/**
 * The state of a table in the URL, for the `validateSearch` of a route (`Schema.toStandardSchemaV1`): the page, the
 * text searched, the sorting among `columns`, the hidden and pinned columns, and one filter per schema of `filters`.
 * A key left out stays out.
 */
export const dataTableSearchSchema = <
  const Column extends string,
  const Filters extends DataTableFilterSchemas = Record<never, never>,
>({
  columns,
  pageSizes,
  filters,
}: {
  columns: readonly [Column, ...ReadonlyArray<Column>];
  /**
   * The page sizes the table offers: any other size in the URL is dropped. Without them, a size up to 100. Share one
   * constant with `DataTablePagination`'s `pageSizes`, so the two do not drift apart.
   */
  pageSizes?: ReadonlyArray<number>;
  filters?: Filters;
}) =>
  Schema.Struct({
    page: orUndefined(Schema.Int.check(Schema.isGreaterThanOrEqualTo(1))),
    size: orUndefined(
      pageSizes === undefined
        ? Schema.Int.check(Schema.isBetween({ minimum: 1, maximum: maxPageSize }))
        : Schema.Finite.check(
            Schema.makeFilter((size) => pageSizes.includes(size) || "a page size of the table"),
          ),
    ),
    q: orUndefined(SearchText),
    orderBy: orUndefined(Schema.Literals(columns)),
    dir: orUndefined(Schema.Literals(["asc", "desc"])),
    hidden: orUndefined(Schema.Array(Schema.String)),
    pinned: orUndefined(Schema.Array(Schema.String)),
    ...(Object.fromEntries(
      Object.entries(filters ?? {}).map(([key, schema]) => [key, orUndefined(schema)]),
    ) as OptionalFilters<Filters>),
  });

export type DataTableSearch<S extends Schema.Top> = S["Type"];

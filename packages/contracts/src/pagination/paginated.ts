import { Effect, Schema } from "effect";

export const PageNumber = Schema.Int.check(Schema.isGreaterThanOrEqualTo(1));

export const defaultPageSize = 20;

export const PaginationQuery = Schema.Struct({
  page: PageNumber.pipe(Schema.withDecodingDefaultKey(Effect.succeed(1))),
  pageSize: Schema.Int.check(Schema.isBetween({ minimum: 1, maximum: 100 })).pipe(
    Schema.withDecodingDefaultKey(Effect.succeed(defaultPageSize)),
  ),
});

export type PaginationQuery = typeof PaginationQuery.Type;

/** `total` counts every item, not only those of the page. */
export const Paginated = <Item extends Schema.Top>(item: Item) =>
  Schema.Struct({ items: Schema.Array(item), total: Schema.Int });

export interface Paginated<A> {
  readonly items: ReadonlyArray<A>;
  readonly total: number;
}

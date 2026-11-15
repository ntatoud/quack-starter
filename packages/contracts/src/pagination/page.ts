import { Effect, Schema } from "effect";

export const PageQuery = Schema.Struct({
  page: Schema.Int.check(Schema.isGreaterThanOrEqualTo(1)).pipe(
    Schema.withDecodingDefaultKey(Effect.succeed(1)),
  ),
  pageSize: Schema.Int.check(Schema.isBetween({ minimum: 1, maximum: 100 })).pipe(
    Schema.withDecodingDefaultKey(Effect.succeed(20)),
  ),
});
export type PageQuery = typeof PageQuery.Type;

/** `total` counts every item, not only those of the page. */
export const Page = <Item extends Schema.Top>(item: Item) =>
  Schema.Struct({ items: Schema.Array(item), total: Schema.Int });
export interface Page<A> {
  readonly items: ReadonlyArray<A>;
  readonly total: number;
}

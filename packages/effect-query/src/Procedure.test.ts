import { Effect, Layer, ManagedRuntime } from "effect";
import { describe, expect, it } from "vite-plus/test";

import { makeProcedure, type Run } from "#/Procedure.ts";

const runtime = ManagedRuntime.make(Layer.empty);
const run: Run<never, never> = (effect, options) => runtime.runPromiseExit(effect, options);

const context = (signal: AbortSignal) => ({ signal }) as never;

describe("makeProcedure", () => {
  it("builds keys that narrow from the procedure to one input", () => {
    const double = makeProcedure(["math", "double"], (n: number) => Effect.succeed(n * 2), run);

    expect(double.key()).toEqual([["math", "double"]]);
    expect(double.key({ type: "query" })).toEqual([["math", "double"], { type: "query" }]);
    expect(double.queryOptions({ input: 2 }).queryKey).toEqual([
      ["math", "double"],
      { type: "query", input: 2 },
    ]);
    expect(double.mutationOptions().mutationKey).toEqual([
      ["math", "double"],
      { type: "mutation" },
    ]);
  });

  it("resolves with the success and keeps the caller's overrides", async () => {
    const double = makeProcedure(["math", "double"], (n: number) => Effect.succeed(n * 2), run);
    const options = double.queryOptions({ input: 2, staleTime: 1000 });

    expect(options.staleTime).toBe(1000);
    await expect(options.queryFn(context(new AbortController().signal))).resolves.toBe(4);
  });

  it("rejects with the failure itself, not a wrapper", async () => {
    const failure = { _tag: "Boom" } as const;
    const boom = makeProcedure(["boom"], () => Effect.fail(failure), run);

    await expect(boom.queryOptions().queryFn(context(new AbortController().signal))).rejects.toBe(
      failure,
    );
  });

  it("rejects with the defect when the Effect dies", async () => {
    const defect = new Error("unexpected");
    const dies = makeProcedure(["dies"], () => Effect.die(defect), run);

    await expect(dies.queryOptions().queryFn(context(new AbortController().signal))).rejects.toBe(
      defect,
    );
  });

  it("interrupts the Effect when the query is cancelled", async () => {
    let interrupted = false;
    const hangs = makeProcedure(
      ["hangs"],
      () =>
        Effect.never.pipe(
          Effect.onInterrupt(() =>
            Effect.sync(() => {
              interrupted = true;
            }),
          ),
        ),
      run,
    );
    const controller = new AbortController();

    const pending = hangs.queryOptions().queryFn(context(controller.signal));
    controller.abort();

    await expect(pending).rejects.toBeDefined();
    expect(interrupted).toBe(true);
  });
});

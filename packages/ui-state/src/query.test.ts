import type { QueryObserverResult } from "@tanstack/react-query";
import { Option } from "effect";
import { describe, expect, it } from "vite-plus/test";

import { fromQuery, matchQuery } from "#/query.ts";

const result = (fields: Partial<QueryObserverResult<string, Error>>) =>
  ({
    isPending: false,
    isLoadingError: false,
    isRefetchError: false,
    data: undefined,
    error: null,
    ...fields,
  }) as QueryObserverResult<string, Error>;

const error = new Error("offline");

describe("fromQuery", () => {
  it("is pending while the first load runs", () => {
    expect(fromQuery(result({ isPending: true }))._tag).toBe("Pending");
  });

  it("fails when the first load fails", () => {
    expect(fromQuery(result({ isLoadingError: true, error }))).toEqual({ _tag: "Error", error });
  });

  it("succeeds with the data and no refresh error", () => {
    expect(fromQuery(result({ data: "todos" }))).toEqual({
      _tag: "Success",
      data: "todos",
      refreshError: Option.none(),
    });
  });

  it("keeps the data when a refetch fails", () => {
    expect(fromQuery(result({ data: "todos", isRefetchError: true, error }))).toEqual({
      _tag: "Success",
      data: "todos",
      refreshError: Option.some(error),
    });
  });
});

describe("matchQuery", () => {
  it("runs the case of the current state, with no case for Idle", () => {
    expect(
      matchQuery(result({ data: "todos" }), {
        Pending: () => "loading",
        Error: () => "failed",
        Success: ({ data }) => `loaded ${data}`,
      }),
    ).toBe("loaded todos");
  });

  it("requires a case for every state", () => {
    // @ts-expect-error: the Error case is missing.
    matchQuery(result({ data: "todos" }), {
      Pending: () => "loading",
      Success: () => "loaded",
    });
  });
});

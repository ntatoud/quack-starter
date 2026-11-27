import type { QueryObserverResult } from "@tanstack/react-query";
import { Option } from "effect";
import { describe, expect, it } from "vite-plus/test";

import { matchQuery, UiState } from "#/ui-state.ts";

type Loaded = Exclude<UiState<string, Error>, { readonly _tag: "Idle" }>;

const offline = new Error("offline");

const describeState = (state: UiState<string, Error>) =>
  UiState.match(state, {
    Idle: () => "idle",
    Pending: () => "loading",
    Error: ({ error }) => `failed: ${error.message}`,
    Success: ({ data, refreshError }) =>
      Option.match(refreshError, {
        onNone: () => `loaded ${data}`,
        onSome: (error) => `loaded ${data}, refresh failed: ${error.message}`,
      }),
  });

const result = (fields: Partial<QueryObserverResult<string, Error>>) =>
  ({
    isPending: false,
    isLoadingError: false,
    isRefetchError: false,
    data: undefined,
    error: null,
    ...fields,
  }) as QueryObserverResult<string, Error>;

const describeQuery = (query: QueryObserverResult<string, Error>) =>
  matchQuery(query, {
    Pending: () => "loading",
    Error: ({ error }) => `failed: ${error.message}`,
    Success: ({ data, refreshError }) =>
      Option.match(refreshError, {
        onNone: () => `loaded ${data}`,
        onSome: (error) => `loaded ${data}, refresh failed: ${error.message}`,
      }),
  });

describe("UiState.match", () => {
  it("runs the case of the current state", () => {
    expect(describeState(UiState.idle())).toBe("idle");
    expect(describeState(UiState.pending())).toBe("loading");
    expect(describeState(UiState.error(offline))).toBe("failed: offline");
    expect(describeState(UiState.success("todos"))).toBe("loaded todos");
    expect(describeState(UiState.success("todos", Option.some(offline)))).toBe(
      "loaded todos, refresh failed: offline",
    );
  });

  it("takes one case per state the type can hold, no more, no less", () => {
    const describeLoaded = (state: Loaded) =>
      UiState.match(state, {
        // @ts-expect-error: this state is never Idle.
        Idle: () => "idle",
        Pending: () => "loading",
        Error: () => "failed",
        Success: () => "loaded",
      });

    const describeWithoutIdle = (state: UiState<string, Error>) =>
      // @ts-expect-error: the Idle case is missing.
      UiState.match(state, {
        Pending: () => "loading",
        Error: () => "failed",
        Success: () => "loaded",
      });

    expect(describeLoaded(UiState.pending())).toBe("loading");
    expect(describeWithoutIdle(UiState.pending())).toBe("loading");
  });
});

describe("matchQuery", () => {
  it("is pending while the first load runs", () => {
    expect(describeQuery(result({ isPending: true }))).toBe("loading");
  });

  it("fails when the first load fails", () => {
    expect(describeQuery(result({ isLoadingError: true, error: offline }))).toBe("failed: offline");
  });

  it("succeeds with the data", () => {
    expect(describeQuery(result({ data: "todos" }))).toBe("loaded todos");
  });

  it("keeps the data when a refetch fails", () => {
    expect(describeQuery(result({ data: "todos", isRefetchError: true, error: offline }))).toBe(
      "loaded todos, refresh failed: offline",
    );
  });

  it("requires a case for every state, and none for Idle", () => {
    // @ts-expect-error: the Error case is missing.
    matchQuery(result({ data: "todos" }), {
      Pending: () => "loading",
      Success: () => "loaded",
    });

    matchQuery(result({ data: "todos" }), {
      // @ts-expect-error: a query is never Idle.
      Idle: () => "idle",
      Pending: () => "loading",
      Error: () => "failed",
      Success: () => "loaded",
    });
  });
});

import { Option } from "effect";
import { describe, expect, it } from "vite-plus/test";

import { UiState } from "#/ui-state.ts";

export type Loaded = Exclude<UiState<string, Error>, { readonly _tag: "Idle" }>;

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

const describeLoaded = (state: Loaded) =>
  UiState.match(state, {
    Pending: () => "loading",
    Error: () => "failed",
    Success: () => "loaded",
  });

export const withoutIdle = (state: UiState<string, Error>) =>
  // @ts-expect-error: the Idle case is missing.
  UiState.match(state, {
    Pending: () => "loading",
    Error: () => "failed",
    Success: () => "loaded",
  });

export const withIdle = (state: Loaded) =>
  UiState.match(state, {
    // @ts-expect-error: this state is never Idle.
    Idle: () => "idle",
    Pending: () => "loading",
    Error: () => "failed",
    Success: () => "loaded",
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

  it("takes only the states the type can hold", () => {
    expect(describeLoaded(UiState.pending())).toBe("loading");
  });
});

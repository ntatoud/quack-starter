import { createAgent } from "@ui-sdk/react/agent";
import { describe, expect, it, vi } from "vite-plus/test";
import { page, userEvent } from "vite-plus/test/browser";
import { render } from "vitest-browser-react";

import { SearchInput } from "@quack/ui/components/search-input";
import { slot } from "@quack/ui/testing/dom";

const agent = createAgent();
const delay = 50;
const searchbox = () => page.getByRole("searchbox", { name: "Search users" });
const clear = () => page.getByRole("button", { name: "Clear search" });

const setup = async (props: { defaultValue?: string; delay?: number } = {}) => {
  const onSearch = vi.fn();

  const screen = await render(
    <SearchInput aria-label="Search users" delay={delay} onSearch={onSearch} {...props} />,
  );

  return { onSearch, screen };
};

const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe("SearchInput", () => {
  it("searches once, with the text trimmed, when the typing pauses", async () => {
    const { onSearch } = await setup();

    await userEvent.type(searchbox(), " Ada ");

    await expect.poll(() => onSearch).toHaveBeenCalledOnce();
    expect(onSearch).toHaveBeenCalledWith("Ada");
  });

  it("does not search before the typing pauses", async () => {
    const { onSearch } = await setup({ delay: 10_000 });

    await userEvent.type(searchbox(), "Ada");
    await pause(delay * 2);

    expect(onSearch).not.toHaveBeenCalled();
  });

  it("searches at once on Enter", async () => {
    const { onSearch } = await setup({ delay: 10_000 });

    await userEvent.type(searchbox(), "Ada{Enter}");

    expect(onSearch).toHaveBeenCalledExactlyOnceWith("Ada");
  });

  it("searches at once for nothing when the text is cleared", async () => {
    const { onSearch } = await setup({ defaultValue: "Ada", delay: 10_000 });
    await expect.element(searchbox()).toHaveValue("Ada");

    await userEvent.clear(searchbox());

    expect(onSearch).toHaveBeenCalledExactlyOnceWith("");
  });

  it("does not search again for the text it last searched", async () => {
    const { onSearch } = await setup({ defaultValue: "Ada" });

    await userEvent.type(searchbox(), " {Enter}");
    await userEvent.type(searchbox(), "x{Backspace}");
    await pause(delay * 3);

    expect(onSearch).not.toHaveBeenCalled();
  });

  it("does not search once it is gone", async () => {
    const { onSearch, screen } = await setup();

    await userEvent.type(searchbox(), "Ada");
    await screen.unmount();
    await pause(delay * 3);

    expect(onSearch).not.toHaveBeenCalled();
  });

  it("shows Clear only while there is text", async () => {
    await setup();
    await expect.element(clear()).not.toBeInTheDocument();

    await userEvent.type(searchbox(), "Ada");
    await expect.element(clear()).toBeVisible();

    await userEvent.clear(searchbox());
    await expect.element(clear()).not.toBeInTheDocument();
  });

  it("empties the input, puts the focus back in it, and searches for nothing at once on Clear", async () => {
    const { onSearch } = await setup({ defaultValue: "Ada", delay: 10_000 });

    await userEvent.click(clear());

    await expect.element(searchbox()).toHaveValue("");
    await expect.element(searchbox()).toHaveFocus();
    await expect.element(clear()).not.toBeInTheDocument();
    expect(onSearch).toHaveBeenCalledExactlyOnceWith("");
  });

  it("clears from the keyboard", async () => {
    const { onSearch } = await setup({ defaultValue: "Ada", delay: 10_000 });

    await userEvent.click(searchbox());
    await userEvent.keyboard("{Tab}{Enter}");

    await expect.element(searchbox()).toHaveValue("");
    await expect.element(searchbox()).toHaveFocus();
    expect(onSearch).toHaveBeenCalledExactlyOnceWith("");
  });

  it("shows a new defaultValue and the Clear button that goes with it", async () => {
    const onSearch = vi.fn();

    const screen = await render(
      <SearchInput aria-label="Search users" onSearch={onSearch} defaultValue="" />,
    );

    await expect.element(clear()).not.toBeInTheDocument();

    await screen.rerender(
      <SearchInput aria-label="Search users" onSearch={onSearch} defaultValue="Ada" />,
    );

    await expect.element(searchbox()).toHaveValue("Ada");
    await expect.element(clear()).toBeVisible();
    expect(onSearch).not.toHaveBeenCalled();
  });

  it("rings the frame while the input has the keyboard focus", async () => {
    await setup();
    const frame = slot("input-group");
    const ring = () => getComputedStyle(frame).boxShadow;
    const resting = ring();

    await userEvent.keyboard("{Tab}");

    await expect.element(searchbox()).toHaveFocus();
    expect(ring()).not.toBe(resting);
  });

  it("lets an agent find, fill, and clear the search", async () => {
    await setup({ delay: 10_000 });

    const labels = agent
      .snapshot()
      .filter((entry) => !entry.offPage)
      .map((entry) => entry.label);

    expect(labels).toContain("Search users");

    const filled = await agent.act({
      steps: [{ ref: "Search users", action: "setValue", args: ["Ada"] }],
    });

    expect(filled.ok, filled.error?.message).toBe(true);
    await expect.element(searchbox()).toHaveValue("Ada");

    const cleared = await agent.act({ steps: [{ ref: "Search users", action: "clear" }] });
    expect(cleared.ok, cleared.error?.message).toBe(true);
    await expect.element(searchbox()).toHaveValue("");
  });
});

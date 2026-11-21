import { createAgent } from "@ui-sdk/react/agent";
import { describe, expect, it, vi } from "vite-plus/test";
import { page, userEvent } from "vite-plus/test/browser";
import { render } from "vitest-browser-react";

import { SearchField } from "#/search-field.tsx";

const agent = createAgent();
const searchbox = () => page.getByRole("searchbox", { name: "Search users" });
const clear = () => page.getByRole("button", { name: "Clear search" });

describe("SearchField", () => {
  it("shows Clear only while there is text", async () => {
    await render(<SearchField aria-label="Search users" />);
    await expect.element(clear()).not.toBeInTheDocument();

    await userEvent.type(searchbox(), "Ada");
    await expect.element(clear()).toBeVisible();

    await userEvent.clear(searchbox());
    await expect.element(clear()).not.toBeInTheDocument();
  });

  it("empties the input and puts the focus back in it on Clear", async () => {
    const onValueChange = vi.fn();
    await render(<SearchField aria-label="Search users" onValueChange={onValueChange} />);
    await userEvent.type(searchbox(), "Ada");

    await userEvent.click(clear());

    await expect.element(searchbox()).toHaveValue("");
    await expect.element(searchbox()).toHaveFocus();
    await expect.element(clear()).not.toBeInTheDocument();
    expect(onValueChange).toHaveBeenLastCalledWith(
      "",
      expect.objectContaining({ reason: "clear-press" }),
    );
  });

  it("clears from the keyboard", async () => {
    await render(<SearchField aria-label="Search users" defaultValue="Ada" />);

    await userEvent.click(searchbox());
    await userEvent.keyboard("{Tab}{Enter}");

    await expect.element(searchbox()).toHaveValue("");
    await expect.element(searchbox()).toHaveFocus();
  });

  it("rings the frame while the input has the keyboard focus", async () => {
    const screen = await render(<SearchField aria-label="Search users" />);
    const frame = screen.container.querySelector<HTMLElement>("[data-slot=input-group]")!;
    const ring = () => getComputedStyle(frame).boxShadow;
    const resting = ring();

    await userEvent.keyboard("{Tab}");

    await expect.element(searchbox()).toHaveFocus();
    expect(ring()).not.toBe(resting);
  });

  it("lets an agent find, fill, and clear the search", async () => {
    await render(<SearchField aria-label="Search users" />);

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

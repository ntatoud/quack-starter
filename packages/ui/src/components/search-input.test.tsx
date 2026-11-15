import { describe, expect, it, vi } from "vite-plus/test";
import { page, userEvent } from "vite-plus/test/browser";
import { render } from "vitest-browser-react";

import { SearchInput } from "@quack/ui/components/search-input";

const delay = 50;
const searchbox = () => page.getByRole("searchbox", { name: "Search users" });

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
});

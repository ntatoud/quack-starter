import { checkPattern } from "@ui-sdk/core/testing";
import { useState } from "react";
import { describe, expect, it } from "vite-plus/test";
import { page, userEvent } from "vite-plus/test/browser";
import { render } from "vitest-browser-react";

import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@quack/ui/components/combobox";

const fruits = ["Apple", "Banana", "Cherry"];

function Fruit(props: {
  showClear?: boolean;
  disabled?: boolean;
  options?: ReadonlyArray<string>;
}) {
  const [value, setValue] = useState<string | null>(null);

  return (
    <Combobox value={value} onValueChange={setValue}>
      <ComboboxInput
        aria-label="Fruit"
        showClear={props.showClear === true && value !== null}
        disabled={props.disabled}
      />
      <ComboboxContent>
        <ComboboxEmpty>No fruit.</ComboboxEmpty>
        <ComboboxList>
          {(props.options ?? fruits).map((fruit) => (
            <ComboboxItem key={fruit} value={fruit}>
              {fruit}
            </ComboboxItem>
          ))}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  );
}

const input = () => page.getByRole("combobox", { name: "Fruit" });
const showOptions = () => page.getByRole("button", { name: "Show options" });
const clear = () => page.getByRole("button", { name: "Clear" });

describe("Combobox", () => {
  it("follows the combobox pattern", async () => {
    const screen = await render(<Fruit />);

    await checkPattern(screen.container, "combobox");
  });

  it("filters its options as one types, and says when none matches", async () => {
    await render(<Fruit />);

    await userEvent.type(input(), "an");
    await expect.element(page.getByRole("option", { name: "Banana" })).toBeVisible();
    expect(page.getByRole("option").elements()).toHaveLength(1);

    await userEvent.type(input(), "z");
    await expect.element(page.getByText("No fruit.")).toBeVisible();
  });

  it("opens its list from its Show options button", async () => {
    await render(<Fruit />);

    await showOptions().click();

    await expect.element(page.getByRole("listbox")).toBeVisible();
    expect(page.getByRole("option").elements()).toHaveLength(fruits.length);
  });

  it("swaps Show options for Clear once chosen, which empties the input", async () => {
    await render(<Fruit showClear />);
    await expect.element(clear()).not.toBeInTheDocument();

    await showOptions().click();
    await page.getByRole("option", { name: "Cherry" }).click();
    await expect.element(input()).toHaveValue("Cherry");
    await expect.element(showOptions()).not.toBeInTheDocument();

    await clear().click();
    await expect.element(input()).toHaveValue("");
    await expect.element(showOptions()).toBeVisible();
  });

  it("scrolls a list longer than its popup down to the last option", async () => {
    const many = Array.from({ length: 100 }, (_, index) => `Fruit ${index + 1}`);
    await render(<Fruit options={many} />);

    await showOptions().click();
    const listbox = page.getByRole("listbox").element();
    listbox.scrollTop = listbox.scrollHeight;

    await expect.element(page.getByRole("option", { name: "Fruit 100" })).toBeInViewport();
  });

  it("once disabled, disables its input and its button", async () => {
    await render(<Fruit disabled />);

    await expect.element(input()).toBeDisabled();
    await expect.element(showOptions()).toBeDisabled();
  });
});

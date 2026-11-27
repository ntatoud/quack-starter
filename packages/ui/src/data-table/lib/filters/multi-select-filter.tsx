import type * as React from "react";

import type { DataTableFilter } from "#/data-table/lib/filters/filter.tsx";
import {
  ClearOptionsItem,
  type DataTableFilterOption,
  type DataTableOptionsStatus,
  labelOf,
  OptionCount,
  OptionsAnnouncement,
  OptionsStatusItems,
  UnknownValue,
} from "#/data-table/lib/filters/options.tsx";
import { Menu, MenuCheckboxItem, MenuContent, MenuTrigger } from "@quack/ui/components/menu";

const namedLabels = 2;

function SelectedCount({ count }: { count: number }) {
  return `${count} selected`;
}

/**
 * A filter that holds any number of its options, in the order of the options. A value the options do not hold
 * stays, after the others and ticked in the menu, until it is unticked or cleared.
 */
export const multiSelectFilter = <const Value extends string>({
  title,
  options,
  placeholder,
  ...status
}: {
  title: string;
  options: ReadonlyArray<DataTableFilterOption<Value>>;
  placeholder?: string;
} & DataTableOptionsStatus): DataTableFilter<ReadonlyArray<string>, Value[]> => {
  const known = new Set<string>(options.map((option) => option.value));

  // Once each, though the URL may repeat them.
  const unknownOf = (values: ReadonlyArray<string>) => [
    ...new Set(values.filter((value) => !known.has(value))),
  ];

  // A value the options lack came from the field, so it is one of the field's values.
  const ordered = (values: ReadonlyArray<string>) =>
    [
      ...options.map((option) => option.value).filter((value) => values.includes(value)),
      ...unknownOf(values),
    ] as Value[];

  return {
    title,
    placeholder,
    summary: (values): React.ReactNode => {
      const shown = ordered(values);

      if (shown.length > namedLabels) return <SelectedCount count={shown.length} />;

      return shown.map((value, index) => (
        <span key={value}>
          {index > 0 && ", "}
          {labelOf(options, value) ?? (
            <UnknownValue value={value} status={status} count={options.length} />
          )}
        </span>
      ));
    },
    editor: ({ trigger, value = [], onValueChange, open, onOpenChange }) => {
      // From the value as it is once earlier ticks land, not as this render saw it: quick ticks all count.
      // The tick of the menu comes from this render too: a second quick tick of one option undoes the first.
      const toggle = (toggled: string) =>
        onValueChange((current = []) =>
          ordered(
            current.includes(toggled)
              ? current.filter((other) => other !== toggled)
              : [...current, toggled],
          ),
        );

      return (
        <>
          <Menu open={open} onOpenChange={onOpenChange}>
            <MenuTrigger {...trigger} />
            <MenuContent className="min-w-36">
              <OptionsStatusItems status={status} count={options.length} />
              {options.map((option) => (
                <MenuCheckboxItem
                  indicator="checkbox"
                  key={option.value}
                  value={option.value}
                  checked={value.includes(option.value)}
                  onCheckedChange={() => toggle(option.value)}
                >
                  {option.label}
                  <OptionCount count={option.count} />
                </MenuCheckboxItem>
              ))}
              {unknownOf(value).map((unknown) => (
                <MenuCheckboxItem
                  indicator="checkbox"
                  key={unknown}
                  value={unknown}
                  checked
                  onCheckedChange={() => toggle(unknown)}
                >
                  <UnknownValue value={unknown} status={status} count={options.length} />
                </MenuCheckboxItem>
              ))}
              {value.length > 0 && <ClearOptionsItem onClear={() => onValueChange([])} />}
            </MenuContent>
          </Menu>
          <OptionsAnnouncement status={status} count={options.length} open={open} />
        </>
      );
    },
  };
};

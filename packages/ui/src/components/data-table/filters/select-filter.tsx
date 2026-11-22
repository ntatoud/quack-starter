import type * as React from "react";

import type { DataTableFilter } from "@quack/ui/components/data-table/filters/filter";
import {
  ClearOptionsItem,
  type DataTableFilterOption,
  type DataTableOptionsStatus,
  labelOf,
  OptionCount,
  OptionsAnnouncement,
  OptionsStatusItems,
  UnknownValue,
} from "@quack/ui/components/data-table/filters/options";
import {
  Menu,
  MenuContent,
  MenuRadioGroup,
  MenuRadioItem,
  MenuTrigger,
} from "@quack/ui/components/menu";

/** A filter that holds one of its options. It reads any text: the URL may hold a value the options lack. */
export const selectFilter = <const Value extends string>({
  title,
  options,
  placeholder,
  ...status
}: {
  title: string;
  options: ReadonlyArray<DataTableFilterOption<Value>>;
  placeholder?: string;
} & DataTableOptionsStatus): DataTableFilter<string, Value> => ({
  title,
  placeholder,
  summary: (value): React.ReactNode =>
    labelOf(options, value) ?? (
      <UnknownValue value={value} status={status} count={options.length} />
    ),
  editor: ({ trigger, value, onValueChange, open, onOpenChange }) => (
    <>
      <Menu open={open} onOpenChange={onOpenChange}>
        <MenuTrigger {...trigger} />
        <MenuContent className="min-w-32">
          <OptionsStatusItems status={status} count={options.length} />
          <MenuRadioGroup
            value={value ?? null}
            onValueChange={(next) => {
              const option = options.find((candidate) => candidate.value === next);

              if (option !== undefined) onValueChange(option.value);
            }}
          >
            {options.map((option) => (
              <MenuRadioItem key={option.value} value={option.value} closeOnSelect>
                {option.label}
                <OptionCount count={option.count} />
              </MenuRadioItem>
            ))}
          </MenuRadioGroup>
          {value !== undefined && <ClearOptionsItem onClear={() => onValueChange(undefined)} />}
        </MenuContent>
      </Menu>
      <OptionsAnnouncement status={status} count={options.length} open={open} />
    </>
  ),
});

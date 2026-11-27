import type { DataTableFilter } from "#/data-table/lib/filters/filter.tsx";
import { ClearOptionsItem } from "#/data-table/lib/filters/options.tsx";
import {
  Menu,
  MenuContent,
  MenuRadioGroup,
  MenuRadioItem,
  MenuTrigger,
} from "@quack/ui/components/menu";

// A radio item holds text, so each boolean goes through the text of its item.
const valueOf = { true: true, false: false } as const;

/** A filter that holds `true` or `false`, each under its label: "Yes" and "No" by default. */
export const booleanFilter = ({
  title,
  labels = { true: "Yes", false: "No" },
}: {
  title: string;
  labels?: { readonly true: string; readonly false: string };
}): DataTableFilter<boolean> => ({
  title,
  summary: (value) => labels[`${value}`],
  editor: ({ trigger, value, onValueChange, open, onOpenChange }) => (
    <Menu open={open} onOpenChange={onOpenChange}>
      <MenuTrigger {...trigger} />
      <MenuContent className="min-w-32">
        <MenuRadioGroup
          value={value === undefined ? null : `${value}`}
          onValueChange={(next: keyof typeof valueOf) => onValueChange(valueOf[next])}
        >
          <MenuRadioItem value="true" closeOnSelect>
            {labels.true}
          </MenuRadioItem>
          <MenuRadioItem value="false" closeOnSelect>
            {labels.false}
          </MenuRadioItem>
        </MenuRadioGroup>
        {value !== undefined && <ClearOptionsItem onClear={() => onValueChange(undefined)} />}
      </MenuContent>
    </Menu>
  ),
});

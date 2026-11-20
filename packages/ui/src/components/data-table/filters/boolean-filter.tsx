import type { DataTableFilter } from "@quack/ui/components/data-table/filters/filter";
import { ClearOptionsItem } from "@quack/ui/components/data-table/filters/options";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@quack/ui/components/dropdown-menu";

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
    <DropdownMenu open={open} onOpenChange={onOpenChange}>
      <DropdownMenuTrigger {...trigger} />
      <DropdownMenuContent className="w-auto min-w-32">
        <DropdownMenuRadioGroup
          value={value === undefined ? null : `${value}`}
          onValueChange={(next: keyof typeof valueOf) => onValueChange(valueOf[next])}
        >
          <DropdownMenuRadioItem value="true" closeOnClick>
            {labels.true}
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="false" closeOnClick>
            {labels.false}
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
        {value !== undefined && <ClearOptionsItem onClear={() => onValueChange(undefined)} />}
      </DropdownMenuContent>
    </DropdownMenu>
  ),
});

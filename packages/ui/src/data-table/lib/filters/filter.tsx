import { XIcon } from "lucide-react";
import * as React from "react";

import { Button } from "@quack/ui/components/button";
import { type DataTableValue, isEmptyValue } from "#/data-table/lib/state.ts";
import { Popover, PopoverContent, PopoverTrigger } from "@quack/ui/components/popover";

export type DataTableFilterValueChange<Read, Write> =
  | Write
  | undefined
  | ((current: Read | undefined) => Write | undefined);

/** What a filter's editor gets: its popup opens from `trigger`, the chip's button. */
export type DataTableFilterEditorProps<Read, Write = Read> = {
  /** The props of the chip's button: spread them on the trigger of the popup. */
  readonly trigger: {
    readonly "data-slot": "data-table-filter-trigger";
    readonly className: string;
    readonly children: React.ReactNode;
  };
  /** The filter's title, to name its popup. */
  readonly title: string;
  readonly value: Read | undefined;
  /**
   * `undefined`, or an empty value, clears the filter and keeps its chip. Given a function, the value is computed from
   * the current one once earlier changes have landed: write a toggle this way, so quick clicks all count.
   */
  readonly onValueChange: (value: DataTableFilterValueChange<Read, Write>) => void;
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
};

/**
 * A filter of a table, whatever its value: one option, several, a range, an operator and its operand... The table
 * frames it in a chip with its title and a remove button; the filter renders what the chip shows and its editor.
 *
 * It reads values of `Read` and writes values of `Write`: a filter fits a field of the state when it reads all the
 * field may hold and writes only what the field accepts. A select reads any text, since the URL may hold a value
 * its options lack, and writes one of its options.
 */
export type DataTableFilter<in Read extends DataTableValue, out Write = Read> = {
  readonly title: string;
  /** What the chip shows while the filter is empty. Defaults to "Select". */
  readonly placeholder?: string | undefined;
  /** What the chip shows after the title, for a value that is not empty. */
  readonly summary: (value: Read) => React.ReactNode;
  readonly editor: (props: DataTableFilterEditorProps<Read, Write>) => React.ReactNode;
  /** Defaults to `isEmptyValue`: nothing, `""`, `[]`, an empty set or map, or a plain object of empty fields. */
  readonly isEmpty?: ((value: Read) => boolean) | undefined;
};

// oxlint-disable-next-line typescript/no-explicit-any -- the filters of one table hold values of different types
export type AnyDataTableFilter = DataTableFilter<any, any>;

export const isFilterEmpty = <Read extends DataTableValue>(
  filter: { readonly isEmpty?: ((value: Read) => boolean) | undefined },
  value: Read | null | undefined,
) =>
  // `null` too: a nullable field of the state holds it, and a filter's own `isEmpty` reads only its values.
  value === undefined || value === null || (filter.isEmpty ?? isEmptyValue)(value);

/**
 * `open`, held back one frame after mount: a popup rendered open takes no focus, and a filter just added mounts open.
 */
function useOpenOnceMounted(open: boolean) {
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => {
    const frame = requestAnimationFrame(() => setMounted(true));

    return () => cancelAnimationFrame(frame);
  }, []);

  return open && mounted;
}

/** The popup of a filter whose editor is a form rather than a list of options: a range, an operator... */
export function DataTableFilterPopover({
  trigger,
  title,
  open,
  onOpenChange,
  className,
  children,
}: Pick<DataTableFilterEditorProps<unknown>, "trigger" | "title" | "open" | "onOpenChange"> & {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger {...trigger} />
      <PopoverContent align="start" aria-label={`${title} filter`} className={className}>
        {children}
      </PopoverContent>
    </Popover>
  );
}

const triggerClassName =
  "flex h-full min-w-0 cursor-pointer items-center gap-1 rounded-s-md ps-2.5 pe-1 outline-none hover:bg-foreground/5 focus-visible:ring-3 focus-visible:ring-ring/50 data-open:bg-foreground/5";

/** A filter shown above a table: its title, what it holds, its editor, and a button to remove it. */
export function DataTableFilterChip<Read extends DataTableValue, Write>({
  filter,
  value,
  onValueChange,
  open,
  onOpenChange,
  onRemove,
}: {
  filter: DataTableFilter<Read, Write>;
  value: Read | undefined;
  onValueChange: (value: DataTableFilterValueChange<Read, Write>) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The button goes away with the filter: give the focus another place. */
  onRemove: () => void;
}) {
  const editorOpen = useOpenOnceMounted(open);
  const root = React.useRef<HTMLDivElement>(null);
  // A menu opened by code takes no focus, and a filter just added from a header opens that way, with the focus
  // left on the header: it goes to the trigger of the filter, so Escape and the arrow keys act on it.
  React.useEffect(() => {
    if (editorOpen && root.current?.contains(document.activeElement) === false)
      root.current.querySelector<HTMLElement>("button")?.focus();
  }, [editorOpen]);

  return (
    <div
      ref={root}
      data-slot="data-table-filter-chip"
      role="group"
      aria-label={`${filter.title} filter`}
      className="flex h-8 max-w-full items-center rounded-md bg-secondary text-sm text-secondary-foreground"
    >
      {filter.editor({
        trigger: {
          "data-slot": "data-table-filter-trigger",
          className: triggerClassName,
          children: (
            <>
              <span
                data-slot="data-table-filter-title"
                className="whitespace-nowrap text-muted-foreground"
              >
                {`${filter.title}:`}
              </span>
              {value === undefined || isFilterEmpty(filter, value) ? (
                <span data-slot="data-table-filter-summary" className="text-muted-foreground">
                  {filter.placeholder ?? "Select"}
                </span>
              ) : (
                // One line, cut short: the whole value stays in the button's name.
                <span data-slot="data-table-filter-summary" className="truncate font-medium">
                  {filter.summary(value)}
                </span>
              )}
            </>
          ),
        },
        title: filter.title,
        value,
        onValueChange,
        open: editorOpen,
        onOpenChange,
      })}
      <Button
        data-slot="data-table-filter-remove"
        variant="ghost"
        size="icon-xs"
        className="me-1"
        aria-label={`Remove the ${filter.title} filter`}
        onClick={onRemove}
      >
        <XIcon />
      </Button>
    </div>
  );
}

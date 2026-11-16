import { XIcon } from "lucide-react";

import { Button } from "@quack/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@quack/ui/components/dropdown-menu";

function DataTableSelectFilter<Value extends string>({
  title,
  options,
  value,
  onValueChange,
  open,
  onOpenChange,
  onRemove,
}: {
  title: string;
  options: ReadonlyArray<{ readonly value: Value; readonly label: string }>;
  value: Value | undefined;
  onValueChange: (value: Value) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The button goes away with the filter: give the focus another place. */
  onRemove: () => void;
}) {
  const label = options.find((option) => option.value === value)?.label;

  return (
    <div
      role="group"
      aria-label={`${title} filter`}
      className="flex h-8 items-center rounded-lg bg-secondary text-sm text-secondary-foreground"
    >
      <DropdownMenu open={open} onOpenChange={onOpenChange}>
        <DropdownMenuTrigger className="flex h-full items-center gap-1 rounded-l-lg pr-1 pl-2.5 outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
          <span className="text-muted-foreground">{title}:</span>
          {label === undefined ? (
            <span className="text-muted-foreground">Select</span>
          ) : (
            <span className="font-medium">{label}</span>
          )}
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-auto min-w-32">
          <DropdownMenuRadioGroup
            value={value ?? null}
            onValueChange={(next: Value) => onValueChange(next)}
          >
            {options.map((option) => (
              <DropdownMenuRadioItem key={option.value} value={option.value} closeOnClick>
                {option.label}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>
      <Button
        variant="ghost"
        size="icon-xs"
        className="mr-1 text-muted-foreground hover:bg-transparent hover:text-foreground"
        aria-label={`Remove the ${title} filter`}
        onClick={onRemove}
      >
        <XIcon />
      </Button>
    </div>
  );
}

export { DataTableSelectFilter };

import * as React from "react";
import { Input, InputClear, InputGroup } from "@ui-sdk/react/input";
import { SearchIcon, XIcon } from "lucide-react";

import {
  InputGroup as InputGroupFrame,
  InputGroupAddon,
  InputGroupButton,
} from "@quack/ui/components/input-group";
import { cn } from "@quack/ui/lib/utils";

function SearchField({
  size = "md",
  className,
  clearLabel = "Clear search",
  ...props
}: Omit<React.ComponentProps<typeof Input>, "type" | "size" | "className"> & {
  className?: string;
  size?: React.ComponentProps<typeof InputGroupFrame>["size"];
  clearLabel?: string;
}) {
  return (
    <InputGroup
      render={<InputGroupFrame size={size} />}
      // ui-sdk keeps `data-slot="input"` on the input, so the frame's own focus ring, keyed on its slot, never shows.
      className={cn(
        "has-[input:focus-visible]:border-ring has-[input:focus-visible]:ring-3 has-[input:focus-visible]:ring-ring/50",
        className,
      )}
    >
      <InputGroupAddon>
        <SearchIcon aria-hidden="true" />
      </InputGroupAddon>
      <Input
        type="search"
        // The Clear button replaces the browser's own.
        className="h-full min-w-0 flex-1 bg-transparent px-2.5 py-1 text-base outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed md:text-sm md:group-data-[size=sm]/input-group:text-[0.8rem] [&::-webkit-search-cancel-button]:appearance-none"
        {...props}
      />
      <InputClear
        render={<InputGroupButton size="icon-xs" className="mr-1" />}
        aria-label={clearLabel}
      >
        <XIcon aria-hidden="true" />
      </InputClear>
    </InputGroup>
  );
}

export { SearchField };

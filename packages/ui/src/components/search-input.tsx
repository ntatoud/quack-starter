import * as React from "react";
import { SearchIcon } from "lucide-react";

import { InputGroup, InputGroupAddon, InputGroupInput } from "@quack/ui/components/input-group";

/**
 * Calls `onSearch` with the trimmed text once the typing pauses for `delay` ms, at once on Enter or when
 * the text is cleared, and never twice in a row with the same text.
 * Uncontrolled: give it a new `key` to replace its text.
 */
function SearchInput({
  defaultValue = "",
  onSearch,
  delay = 300,
  size = "md",
  className,
  onChange,
  onKeyDown,
  ...props
}: Omit<React.ComponentProps<typeof InputGroupInput>, "type" | "defaultValue" | "value" | "ref"> & {
  defaultValue?: string;
  onSearch: (search: string) => void;
  delay?: number;
  size?: React.ComponentProps<typeof InputGroup>["size"];
}) {
  const timer = React.useRef<ReturnType<typeof setTimeout>>(undefined);
  const searched = React.useRef(defaultValue.trim());

  const search = (text: string) => {
    clearTimeout(timer.current);
    const trimmed = text.trim();
    if (trimmed === searched.current) return;
    searched.current = trimmed;
    onSearch(trimmed);
  };

  // A search that is still waiting must not run once the input is gone. Stable, so React runs its
  // cleanup on unmount only, not on every render.
  const cancelOnUnmount = React.useCallback(() => () => clearTimeout(timer.current), []);

  return (
    <InputGroup size={size} className={className}>
      <InputGroupAddon>
        <SearchIcon />
      </InputGroupAddon>
      <InputGroupInput
        ref={cancelOnUnmount}
        type="search"
        defaultValue={defaultValue}
        onChange={(event) => {
          onChange?.(event);
          const text = event.currentTarget.value;
          clearTimeout(timer.current);
          if (text.trim() === "") search(text);
          else timer.current = setTimeout(() => search(text), delay);
        }}
        onKeyDown={(event) => {
          onKeyDown?.(event);
          if (event.key === "Enter") search(event.currentTarget.value);
        }}
        {...props}
      />
    </InputGroup>
  );
}

export { SearchInput };

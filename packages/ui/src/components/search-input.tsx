import * as React from "react";
import { InputClear } from "@ui-sdk/react/input";
import { SearchIcon, XIcon } from "lucide-react";

import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@quack/ui/components/input-group";

const setRef = <T,>(ref: React.Ref<T> | undefined, value: T) => {
  if (typeof ref === "function") {
    const cleanup = ref(value);
    return () => (typeof cleanup === "function" ? cleanup() : ref(null));
  }
  if (ref) ref.current = value;
  return () => {
    if (ref) ref.current = null;
  };
};

/**
 * Calls `onSearch` with the trimmed text once the typing pauses for `delay` ms, at once on Enter, on blur, or when
 * the text is cleared, and never twice in a row with the same text.
 * Uncontrolled: it shows a new `defaultValue` only when it is another search than the last it sent (Back, a reset),
 * so the search it sent coming back does not replace what was typed since.
 */
function SearchInput({
  defaultValue = "",
  onSearch,
  delay = 300,
  size = "md",
  className,
  clearLabel = "Clear search",
  onValueChange,
  onKeyDown,
  onBlur,
  ref,
  ...props
}: Omit<
  React.ComponentProps<typeof InputGroupInput>,
  "type" | "defaultValue" | "value" | "controller" | "ref"
> & {
  ref?: React.Ref<HTMLInputElement>;
  defaultValue?: string;
  onSearch: (search: string) => void;
  delay?: number;
  size?: React.ComponentProps<typeof InputGroup>["size"];
  clearLabel?: string;
}) {
  const timer = React.useRef<ReturnType<typeof setTimeout>>(undefined);
  const searched = React.useRef(defaultValue.trim());
  const [value, setValue] = React.useState(defaultValue);

  React.useLayoutEffect(() => {
    if (defaultValue.trim() === searched.current) return;
    clearTimeout(timer.current);
    searched.current = defaultValue.trim();
    setValue(defaultValue);
  }, [defaultValue]);

  const search = (text: string) => {
    clearTimeout(timer.current);
    const trimmed = text.trim();
    if (trimmed === searched.current) return;
    searched.current = trimmed;
    onSearch(trimmed);
  };

  // A search that is still waiting must not run once the input is gone. Stable while `ref` is, so React runs its
  // cleanup on unmount only, not on every render.
  const attach = React.useCallback(
    (node: HTMLInputElement | null) => {
      const detach = setRef(ref, node);
      return () => {
        clearTimeout(timer.current);
        detach();
      };
    },
    [ref],
  );

  return (
    <InputGroup size={size} className={className}>
      <InputGroupAddon>
        <SearchIcon aria-hidden="true" />
      </InputGroupAddon>
      <InputGroupInput
        ref={attach}
        type="search"
        value={value}
        onValueChange={(text, details) => {
          onValueChange?.(text, details);
          setValue(text);
          clearTimeout(timer.current);
          if (text.trim() === "") search(text);
          else timer.current = setTimeout(() => search(text), delay);
        }}
        onKeyDown={(event) => {
          onKeyDown?.(event);
          if (event.key === "Enter") search(event.currentTarget.value);
        }}
        // A search still waiting runs when the input is left, so a click that follows (a reset, a link) acts on it.
        onBlur={(event) => {
          onBlur?.(event);
          search(event.currentTarget.value);
        }}
        // The Clear button replaces the browser's own.
        className="[&::-webkit-search-cancel-button]:appearance-none"
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

export { SearchInput };

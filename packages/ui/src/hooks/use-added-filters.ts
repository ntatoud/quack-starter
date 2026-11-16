import { useState } from "react";

// A filter added without a value lives here until it gets one; from then on the value says it is shown,
// so going back to a URL without it hides it.
export function useAddedFilters<Key extends string>(hasValue: (key: Key) => boolean) {
  const [added, setAdded] = useState<ReadonlySet<Key>>(new Set());
  const [open, setOpen] = useState<Key | null>(null);
  const waiting = [...added].filter((key) => !hasValue(key));
  if (waiting.length !== added.size) setAdded(new Set(waiting));

  return {
    isShown: (key: Key) => hasValue(key) || added.has(key),
    isOpen: (key: Key) => open === key,
    setOpen: (key: Key, isOpen: boolean) =>
      setOpen((current) => (isOpen ? key : current === key ? null : current)),
    add: (key: Key) => {
      setAdded((keys) => new Set(keys).add(key));
      setOpen(key);
    },
    remove: (key: Key) => {
      setAdded((keys) => new Set([...keys].filter((other) => other !== key)));
      setOpen((current) => (current === key ? null : current));
    },
  };
}

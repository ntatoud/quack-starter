/** `set` with `item` in it when `on`, out of it otherwise: a new Set, as React state needs. */
export const toggled = <A>(set: ReadonlySet<A>, item: A, on: boolean): ReadonlySet<A> => {
  const next = new Set(set);

  if (on) next.add(item);
  else next.delete(item);

  return next;
};

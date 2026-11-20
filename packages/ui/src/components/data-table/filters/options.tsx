import { LoaderCircleIcon, RotateCwIcon } from "lucide-react";

import { DropdownMenuItem, DropdownMenuSeparator } from "@quack/ui/components/dropdown-menu";

export type DataTableFilterOption<Value extends string> = {
  readonly value: Value;
  readonly label: string;
  /** How many rows hold it, shown next to its label. */
  readonly count?: number | undefined;
};

/** Where options that a request loads stand: on their way, or failed with a way to ask again. */
export type DataTableOptionsStatus = {
  /**
   * True while the options are on their way, a retry after an error included: a failed TanStack Query keeps its
   * error while it fetches again, so pass `isFetching`, not `isPending`.
   */
  readonly loading?: boolean | undefined;
  readonly error?: { readonly retry: () => void } | undefined;
};

/** The label of `value` among `options`, or `undefined` when they do not hold it. */
export const labelOf = (options: ReadonlyArray<DataTableFilterOption<string>>, value: string) =>
  options.find((option) => option.value === value)?.label;

/**
 * Whether the options are still to come: loading with none yet, or after an error. A refetch of options already
 * there, in the background, holds nothing back.
 */
const awaited = (status: DataTableOptionsStatus, count: number) =>
  status.loading === true && (count === 0 || status.error !== undefined);

/** A value the options do not hold: not loaded yet, failed to load, or gone since the URL was written. */
export function UnknownValue({
  value,
  status,
  count,
}: {
  value: string;
  status: DataTableOptionsStatus;
  /** How many options there are. */
  count: number;
}) {
  const reason = awaited(status, count)
    ? "loading"
    : status.error === undefined
      ? "not an option"
      : "could not load";
  return (
    <span className="text-muted-foreground italic">
      {value}
      <span className="sr-only"> ({reason})</span>
    </span>
  );
}

export function OptionCount({ count }: { count: number | undefined }) {
  return count === undefined ? null : (
    <span className="ms-auto ps-3 text-xs text-muted-foreground tabular-nums">{count}</span>
  );
}

/** The item that clears a filter of options, below them. */
export function ClearOptionsItem({ onClear }: { onClear: () => void }) {
  return (
    <>
      <DropdownMenuSeparator />
      <DropdownMenuItem onClick={onClear}>Clear</DropdownMenuItem>
    </>
  );
}

/** What a menu of options shows above them while they load, once they failed, or when there are none. */
export function OptionsStatusItems({
  status,
  count,
}: {
  status: DataTableOptionsStatus;
  /** How many options there are. */
  count: number;
}) {
  const empty = count === 0;
  if (status.error !== undefined)
    return (
      <>
        <DropdownMenuItem disabled>Could not load the options</DropdownMenuItem>
        {status.loading === true ? (
          <DropdownMenuItem disabled>
            <LoaderCircleIcon className="animate-spin text-muted-foreground motion-reduce:animate-none" />
            Trying again…
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem closeOnClick={false} onClick={status.error.retry}>
            <RotateCwIcon className="text-muted-foreground" />
            Retry
          </DropdownMenuItem>
        )}
        {!empty && <DropdownMenuSeparator />}
      </>
    );
  if (status.loading === true && empty)
    return (
      <DropdownMenuItem disabled>
        <LoaderCircleIcon className="animate-spin text-muted-foreground motion-reduce:animate-none" />
        Loading…
      </DropdownMenuItem>
    );
  if (empty) return <DropdownMenuItem disabled>No options</DropdownMenuItem>;
  return null;
}

/**
 * What a filter of options says aloud as they load, arrive, or fail: the item that asked again goes away with the
 * error. Outside the menu, which holds menu items only.
 */
export function OptionsAnnouncement({
  status,
  count,
  open,
}: {
  status: DataTableOptionsStatus;
  count: number;
  /** Whether the menu is open: a closed one has nothing to say. */
  open: boolean;
}) {
  const announcement = awaited(status, count)
    ? "Loading the options"
    : status.error === undefined
      ? `${count} option${count === 1 ? "" : "s"}`
      : "Could not load the options";
  return (
    // Mounted while closed too, empty: a live region already in place is the one screen readers follow.
    <span role="status" className="sr-only">
      {open ? announcement : ""}
    </span>
  );
}

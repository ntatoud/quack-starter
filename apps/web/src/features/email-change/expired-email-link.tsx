import { ButtonLink } from "#/components/button-link.tsx";

/** What an Email Change link that was used, cancelled, replaced, or has expired leads to. */
export function ExpiredEmailLink() {
  return (
    <div className="flex flex-col gap-4">
      <p role="status" className="text-sm">
        This link has expired or was already used. Your email has not changed.
      </p>
      <ButtonLink to="/app/settings/email">Ask for a new link</ButtonLink>
    </div>
  );
}

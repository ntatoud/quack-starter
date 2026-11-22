import { ButtonLink } from "#/components/button-link.tsx";

/** What a Password Reset link that was used, has expired, or never existed leads to. */
export function ExpiredResetLink() {
  return (
    <div className="flex flex-col gap-4">
      <p role="status" className="text-sm">
        This link has expired or was already used.
      </p>
      <ButtonLink to="/forgot-password">Ask for a new link</ButtonLink>
    </div>
  );
}

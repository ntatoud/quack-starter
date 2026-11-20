export const fullName = (profile: { readonly firstName: string; readonly lastName: string }) =>
  `${profile.firstName} ${profile.lastName}`;

/** How a User is named: their full name, or their email while they have no Profile. */
export const userLabel = (user: {
  readonly email: string;
  readonly profile: { readonly firstName: string; readonly lastName: string } | null;
}) => (user.profile === null ? user.email : fullName(user.profile));

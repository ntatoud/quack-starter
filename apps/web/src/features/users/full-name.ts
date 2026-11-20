export const fullName = (profile: { readonly firstName: string; readonly lastName: string }) =>
  `${profile.firstName} ${profile.lastName}`;

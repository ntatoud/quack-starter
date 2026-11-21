import type { ReactElement } from "react";
import { render } from "react-email";

export interface RenderedEmail {
  readonly subject: string;
  readonly html: string;
  readonly text: string;
}

export const renderEmail = async (
  subject: string,
  email: ReactElement,
): Promise<RenderedEmail> => ({
  subject,
  html: await render(email),
  text: await render(email, { plainText: true }),
});

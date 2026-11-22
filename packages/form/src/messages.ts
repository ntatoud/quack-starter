import type { ValidationError } from "@tanstack/react-form";

export type Message = { message?: string };

export type IssuesByPath = Readonly<Record<string, ReadonlyArray<Message>>>;

const isText = (error: ValidationError): error is string => typeof error === "string";

/** Schema validators report their issues by path; a function validator reports a string, or nothing. */
export const isIssuesByPath = (error: ValidationError): error is IssuesByPath =>
  typeof error === "object" && error !== null;

/** Schema validators report issues; function validators may return a plain string. */
export const toMessage = (error: ValidationError): Message | undefined =>
  isText(error) ? { message: error } : (error as Message | undefined);

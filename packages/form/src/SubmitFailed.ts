/**
 * Thrown by `onSubmit` when the submission fails, for example when its request fails.
 * `form.Root` shows its message until the next edit. Any other error thrown by `onSubmit` is a bug and is reported.
 */
export class SubmitFailed extends Error {
  override readonly name = "SubmitFailed";
}

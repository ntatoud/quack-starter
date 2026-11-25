/**
 * Thrown by `onSubmit` when the request was refused for the value of one field, such as a wrong password: `form.Root`
 * shows `message` as that field's error, focuses it, and clears it once the value changes.
 */
export class FieldRefused extends Error {
  override readonly name = "FieldRefused";
  readonly field: string;

  constructor(field: string, message: string, options?: ErrorOptions) {
    super(message, options);
    this.field = field;
  }
}

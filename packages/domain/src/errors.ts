export class AppError extends Error {
  constructor(
    public code: string,
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
export function assert(
  condition: unknown,
  message: string,
  code = 'VALIDATION',
): asserts condition {
  if (!condition) throw new AppError(code, message);
}

export class AppError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
  ) {
    super(code);
    this.name = "AppError";
  }
}

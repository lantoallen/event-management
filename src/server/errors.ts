import type { ContentfulStatusCode } from "hono/utils/http-status";

// Thrown anywhere in the server and turned into a JSON error by the app.
export class AppError extends Error {
  constructor(
    readonly status: ContentfulStatusCode,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

export const badRequest = (message: string, code = "invalid_input") =>
  new AppError(400, code, message);
export const unauthorized = (message = "Please log in first.") =>
  new AppError(401, "unauthorized", message);
export const forbidden = (message = "You can't do that.") =>
  new AppError(403, "forbidden", message);
export const notFound = (message = "Not found.") => new AppError(404, "not_found", message);
export const conflict = (code: string, message: string) => new AppError(409, code, message);
export const tooManyRequests = (message = "Too many tries. Wait a few minutes.") =>
  new AppError(429, "rate_limited", message);

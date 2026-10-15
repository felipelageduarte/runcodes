// Domain errors carry their own HTTP status and a stable machine-readable
// `code` so the transport layer (error middleware) can report them
// correctly without any instanceof chain scattered across route handlers.
// `message` is for logs; `code` is what the client sees in the response body.
export abstract class AppError extends Error {
  abstract readonly status: number;

  constructor(
    message: string,
    readonly code: string,
  ) {
    super(message);
  }
}

export class NotFoundError extends AppError {
  readonly status = 404;
  constructor(message = "Resource not found", code = "not_found") {
    super(message, code);
  }
}

export class ForbiddenError extends AppError {
  readonly status = 403;
  constructor(message = "Forbidden", code = "forbidden") {
    super(message, code);
  }
}

export class UnauthorizedError extends AppError {
  readonly status = 401;
  constructor(message = "Unauthorized", code = "unauthorized") {
    super(message, code);
  }
}

export class ConflictError extends AppError {
  readonly status = 409;
  constructor(message = "Conflict", code = "conflict") {
    super(message, code);
  }
}

export class ValidationError extends AppError {
  readonly status = 422;
  constructor(message = "Validation failed", code = "validation_error") {
    super(message, code);
  }
}

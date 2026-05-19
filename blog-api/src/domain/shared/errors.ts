export class NotFoundError extends Error {
  readonly code = 'NOT_FOUND' as const;
  constructor(message: string) {
    super(message);
    this.name = 'NotFoundError';
  }
}

export class ConflictError extends Error {
  readonly code = 'CONFLICT' as const;
  constructor(message: string) {
    super(message);
    this.name = 'ConflictError';
  }
}

export class UnauthorizedError extends Error {
  readonly code = 'UNAUTHORIZED' as const;
  constructor(message = 'Unauthorized') {
    super(message);
    this.name = 'UnauthorizedError';
  }
}

export class ValidationError extends Error {
  readonly code = 'VALIDATION' as const;
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class UpstreamError extends Error {
  readonly code = 'UPSTREAM_ERROR' as const;
  constructor(
    message: string,
    public readonly statusCode: number = 502,
  ) {
    super(message);
    this.name = 'UpstreamError';
  }
}

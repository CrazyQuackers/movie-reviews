import type { NextFunction, Request, Response } from 'express';
import mongoose from 'mongoose';
import { AppError } from '../errors/AppError';

export function notFoundHandler(req: Request, _res: Response, next: NextFunction): void {
  next(AppError.notFound(`Route ${req.method} ${req.originalUrl} not found`));
}

function isDuplicateKeyError(err: unknown): err is { code: 11000; keyValue?: Record<string, unknown> } {
  return typeof err === 'object' && err !== null && 'code' in err && err.code === 11000;
}

/**
 * Turns known non-AppError errors into AppErrors, so routes don't have to catch them:
 * - Mongoose CastError (e.g. an invalid ObjectId in a URL) -> 400
 * - Mongoose ValidationError (schema rules) -> 400 with per-field details
 * - MongoDB duplicate key (unique index) -> 409 (only field names, never the values)
 * - malformed JSON body from express.json() -> 400
 */
function toAppError(err: unknown): AppError | undefined {
  if (err instanceof AppError) return err;
  if (err instanceof mongoose.Error.CastError) {
    return AppError.badRequest(`Invalid value for "${err.path}"`);
  }
  if (err instanceof mongoose.Error.ValidationError) {
    const details = Object.values(err.errors).map((e) => ({ path: e.path, message: e.message }));
    return AppError.badRequest('Validation failed', details);
  }
  if (isDuplicateKeyError(err)) {
    return new AppError(409, 'CONFLICT', 'Resource already exists', { fields: Object.keys(err.keyValue ?? {}) });
  }
  if (err instanceof SyntaxError && 'body' in err) {
    return AppError.badRequest('Malformed JSON body');
  }
  return undefined;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction): void {
  const appError = toAppError(err);
  if (appError) {
    res.status(appError.status).json({
      error: {
        code: appError.code,
        message: appError.message,
        ...(appError.details !== undefined && { details: appError.details }),
      },
    });
    return;
  }
  console.error(err);
  res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } });
}

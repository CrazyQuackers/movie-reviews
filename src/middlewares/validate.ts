import type { NextFunction, Request, Response } from 'express';
import type { ZodType } from 'zod';
import { AppError } from '../errors/AppError';

type Source = 'body' | 'query' | 'params';

/** Validates req[source] with a Zod schema and replaces it with the parsed value. */
export function validate(schema: ZodType, source: Source = 'body') {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req[source]);
    if (!result.success) {
      throw AppError.badRequest('Validation failed', result.error.issues);
    }
    // Express 5: req.query is a getter, so define the parsed value on the request.
    Object.defineProperty(req, source, { value: result.data, writable: true, configurable: true });
    next();
  };
}

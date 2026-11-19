import type { NextFunction, Request, Response } from 'express';
import { AppError } from '../errors/AppError';
import type { AuthRequest } from '../types/auth';
import { verifyToken } from '../utils/jwt';

/**
 * Verifies `Authorization: Bearer <jwt>` and sets `req.user = { id }`.
 * Token payload contract: `{ sub: <userId> }` (see utils/jwt.ts).
 */
export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    throw AppError.unauthorized('Missing bearer token');
  }

  let userId: string;
  try {
    userId = verifyToken(header.slice(7));
  } catch {
    throw AppError.unauthorized('Invalid or expired token');
  }

  (req as AuthRequest).user = { id: userId };
  next();
}

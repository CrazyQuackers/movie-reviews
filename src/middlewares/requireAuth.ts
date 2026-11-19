import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { AppError } from '../errors/AppError';
import type { AuthRequest } from '../types/auth';

/**
 * Verifies `Authorization: Bearer <jwt>` and sets `req.user = { id }`.
 * Token payload contract: `{ sub: <userId> }`. (Token signing belongs to mission A1.)
 */
export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    throw AppError.unauthorized('Missing bearer token');
  }
  try {
    const payload = jwt.verify(header.slice(7), env.jwtSecret);
    if (typeof payload === 'string' || typeof payload.sub !== 'string') {
      throw AppError.unauthorized('Invalid token');
    }
    (req as AuthRequest).user = { id: payload.sub };
    next();
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw AppError.unauthorized('Invalid or expired token');
  }
}

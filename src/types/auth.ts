import type { Request } from 'express';

export interface AuthUser {
  id: string;
}

/** Request after `requireAuth` has run: `req.user` is guaranteed. */
export interface AuthRequest extends Request {
  user: AuthUser;
}

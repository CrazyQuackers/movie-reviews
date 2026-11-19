import jwt, { type SignOptions } from 'jsonwebtoken';
import { env } from '../config/env';

/** Signs an access token. Contract (shared with requireAuth): payload `{ sub: <userId> }`. */
export function signToken(userId: string): string {
  return jwt.sign({}, env.jwtSecret, {
    subject: userId,
    expiresIn: env.jwtExpiresIn as SignOptions['expiresIn'],
  });
}

/** Verifies a token and returns the user id (`sub`). Throws if invalid, expired or missing `sub`. */
export function verifyToken(token: string): string {
  const payload = jwt.verify(token, env.jwtSecret);
  if (typeof payload === 'string' || typeof payload.sub !== 'string') {
    throw new Error('Token payload has no subject');
  }
  return payload.sub;
}

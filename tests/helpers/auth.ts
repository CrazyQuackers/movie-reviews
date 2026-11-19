import mongoose from 'mongoose';
import * as authService from '../../src/services/authService';
import { signToken } from '../../src/utils/jwt';

/**
 * Signs a token for the given user id (random if omitted). No DB needed.
 * Handy for unit/API tests that only need "some logged-in user".
 */
export function signTestToken(userId: string = new mongoose.Types.ObjectId().toString()) {
  const token = signToken(userId);
  return { userId, token, authHeader: `Bearer ${token}` };
}

let counter = 0;

/**
 * Registers a real user in the (test) database and returns it with a token.
 * Requires `startTestDb()` to have run. Each call creates a unique user unless overridden.
 */
export async function createUserAndToken(
  overrides: Partial<{ username: string; email: string; password: string }> = {},
) {
  counter += 1;
  const input = {
    username: `user${counter}_${Date.now()}`,
    email: `user${counter}_${Date.now()}@test.io`,
    password: 'password123',
    ...overrides,
  };
  const { user, token } = await authService.register(input);
  return { user, userId: user.id, token, authHeader: `Bearer ${token}`, password: input.password };
}

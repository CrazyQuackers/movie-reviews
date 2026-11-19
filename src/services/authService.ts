import bcrypt from 'bcrypt';
import { AppError } from '../errors/AppError';
import { userRepository } from '../repositories/userRepository';
import type { AuthResult, PublicUser } from '../types/user';
import { signToken } from '../utils/jwt';
import type { LoginInput, RegisterInput } from '../validators/auth';

const SALT_ROUNDS = 10;
const INVALID_CREDENTIALS = 'Invalid email or password';

interface UserLike {
  _id: unknown;
  username: string;
  email: string;
  createdAt: Date;
  updatedAt: Date;
}

export function toPublicUser(user: UserLike): PublicUser {
  return {
    id: String(user._id),
    username: user.username,
    email: user.email,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

function isDuplicateKeyError(err: unknown): boolean {
  return typeof err === 'object' && err !== null && 'code' in err && err.code === 11000;
}

export async function register(input: RegisterInput): Promise<AuthResult> {
  const email = input.email.toLowerCase();
  const username = input.username;

  const existing = await userRepository.findByEmailOrUsername(email, username);
  if (existing) {
    throw AppError.conflict(existing.email === email ? 'Email is already registered' : 'Username is already taken');
  }

  const passwordHash = await bcrypt.hash(input.password, SALT_ROUNDS);

  const user = await userRepository.create({ username, email, passwordHash }).catch((err: unknown) => {
    // Two requests registering the same email at once: the unique index catches it.
    if (isDuplicateKeyError(err)) throw AppError.conflict('Email or username is already taken');
    throw err;
  });

  return { user: toPublicUser(user), token: signToken(String(user._id)) };
}

export async function login(input: LoginInput): Promise<AuthResult> {
  const user = await userRepository.findByEmailWithPassword(input.email.toLowerCase());
  // Same error for "no such user" and "wrong password", so emails can't be probed.
  if (!user) throw AppError.unauthorized(INVALID_CREDENTIALS);

  const matches = await bcrypt.compare(input.password, user.passwordHash);
  if (!matches) throw AppError.unauthorized(INVALID_CREDENTIALS);

  return { user: toPublicUser(user), token: signToken(String(user._id)) };
}

import bcrypt from 'bcrypt';
import mongoose from 'mongoose';
import { AppError } from '../../src/errors/AppError';
import { userRepository } from '../../src/repositories/userRepository';
import * as authService from '../../src/services/authService';
import { verifyToken } from '../../src/utils/jwt';

jest.mock('../../src/repositories/userRepository');

const repo = jest.mocked(userRepository);

function fakeUser(overrides: Partial<{ username: string; email: string; passwordHash: string }> = {}) {
  return {
    _id: new mongoose.Types.ObjectId(),
    username: 'neo',
    email: 'neo@matrix.io',
    passwordHash: 'hash',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

/** Plain object -> the repository's Mongoose document type (only for mocks). */
const asDoc = (u: ReturnType<typeof fakeUser>) => u as never;

async function expectAppError(promise: Promise<unknown>, status: number) {
  const err = await promise.then(
    () => undefined,
    (e: unknown) => e,
  );
  expect(err).toBeInstanceOf(AppError);
  expect((err as AppError).status).toBe(status);
}

beforeEach(() => jest.resetAllMocks());

describe('authService.register', () => {
  const input = { username: 'neo', email: 'Neo@Matrix.io', password: 'red-pill-123' };

  it('rejects with 409 when the email is already registered', async () => {
    repo.findByEmailOrUsername.mockResolvedValue(asDoc(fakeUser({ email: 'neo@matrix.io', username: 'other' })));
    await expectAppError(authService.register(input), 409);
    expect(repo.create).not.toHaveBeenCalled();
  });

  it('rejects with 409 when the username is taken', async () => {
    repo.findByEmailOrUsername.mockResolvedValue(asDoc(fakeUser({ email: 'someone@else.io', username: 'neo' })));
    await expectAppError(authService.register(input), 409);
  });

  it('stores a bcrypt hash (not the plain password) and a lowercased email', async () => {
    repo.findByEmailOrUsername.mockResolvedValue(null);
    repo.create.mockImplementation(async (data) => asDoc(fakeUser(data)));

    await authService.register(input);

    const data = repo.create.mock.calls[0][0];
    expect(data.email).toBe('neo@matrix.io');
    expect(data.passwordHash).not.toBe(input.password);
    expect(await bcrypt.compare(input.password, data.passwordHash)).toBe(true);
  });

  it('returns a public user (no passwordHash) and a token for that user', async () => {
    const created = fakeUser();
    repo.findByEmailOrUsername.mockResolvedValue(null);
    repo.create.mockResolvedValue(asDoc(created));

    const result = await authService.register(input);

    expect(result.user).not.toHaveProperty('passwordHash');
    expect(result.user).toMatchObject({ id: String(created._id), username: 'neo', email: 'neo@matrix.io' });
    expect(verifyToken(result.token)).toBe(String(created._id));
  });

  it('maps a duplicate-key race from the database to 409', async () => {
    repo.findByEmailOrUsername.mockResolvedValue(null);
    repo.create.mockRejectedValue(Object.assign(new Error('E11000 duplicate key'), { code: 11000 }));
    await expectAppError(authService.register(input), 409);
  });
});

describe('authService.login', () => {
  const password = 'red-pill-123';

  it('rejects with 401 for an unknown email', async () => {
    repo.findByEmailWithPassword.mockResolvedValue(null);
    await expectAppError(authService.login({ email: 'nobody@x.io', password }), 401);
  });

  it('rejects with 401 for a wrong password', async () => {
    repo.findByEmailWithPassword.mockResolvedValue(asDoc(fakeUser({ passwordHash: await bcrypt.hash(password, 4) })));
    await expectAppError(authService.login({ email: 'neo@matrix.io', password: 'wrong-password' }), 401);
  });

  it('looks the user up by lowercased email and returns user + token on success', async () => {
    const user = fakeUser({ passwordHash: await bcrypt.hash(password, 4) });
    repo.findByEmailWithPassword.mockResolvedValue(asDoc(user));

    const result = await authService.login({ email: 'NEO@matrix.io', password });

    expect(repo.findByEmailWithPassword).toHaveBeenCalledWith('neo@matrix.io');
    expect(result.user).not.toHaveProperty('passwordHash');
    expect(verifyToken(result.token)).toBe(String(user._id));
  });
});

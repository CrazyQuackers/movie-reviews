import bcrypt from 'bcrypt';
import { User } from '../../src/models/User';
import * as authService from '../../src/services/authService';
import { verifyToken } from '../../src/utils/jwt';
import { clearTestDb, startTestDb, stopTestDb } from '../helpers/db';

beforeAll(async () => {
  await startTestDb();
  await User.init(); // make sure unique indexes exist before the tests run
});
afterEach(clearTestDb);
afterAll(stopTestDb);

const input = { username: 'trinity', email: 'Trinity@Matrix.io', password: 'follow-the-rabbit' };

describe('authService (with MongoDB)', () => {
  it('register saves the user with a hashed password and lowercased email', async () => {
    const { user } = await authService.register(input);

    const saved = await User.findById(user.id).select('+passwordHash');
    expect(saved).not.toBeNull();
    expect(saved?.email).toBe('trinity@matrix.io');
    expect(saved?.passwordHash).not.toBe(input.password);
    expect(await bcrypt.compare(input.password, saved?.passwordHash as string)).toBe(true);
  });

  it('does not return passwordHash from normal queries', async () => {
    const { user } = await authService.register(input);
    const found = await User.findById(user.id).lean();
    expect(found).not.toHaveProperty('passwordHash');
  });

  it('register rejects a second user with the same email or username (409)', async () => {
    await authService.register(input);
    await expect(
      authService.register({ ...input, username: 'someone-else' }),
    ).rejects.toMatchObject({ status: 409 });
    await expect(
      authService.register({ ...input, email: 'other@matrix.io' }),
    ).rejects.toMatchObject({ status: 409 });
  });

  it('the database enforces unique email even without the service check', async () => {
    await User.create({ username: 'a', email: 'dup@x.io', passwordHash: 'h' });
    await expect(User.create({ username: 'b', email: 'dup@x.io', passwordHash: 'h' })).rejects.toMatchObject({
      code: 11000,
    });
  });

  it('login works with the registered credentials (email is case-insensitive)', async () => {
    const { user } = await authService.register(input);
    const result = await authService.login({ email: 'TRINITY@matrix.io', password: input.password });
    expect(result.user.id).toBe(user.id);
    expect(verifyToken(result.token)).toBe(user.id);
  });

  it('login rejects a wrong password (401)', async () => {
    await authService.register(input);
    await expect(authService.login({ email: input.email, password: 'nope-nope-nope' })).rejects.toMatchObject({
      status: 401,
    });
  });
});

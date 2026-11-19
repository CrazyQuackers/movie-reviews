import jwt from 'jsonwebtoken';
import { signToken, verifyToken } from '../../src/utils/jwt';

describe('jwt utils', () => {
  const userId = '507f1f77bcf86cd799439011';

  it('signs a token whose `sub` is the user id', () => {
    const token = signToken(userId);
    const payload = jwt.verify(token, process.env.JWT_SECRET as string);
    expect(typeof payload).toBe('object');
    expect((payload as jwt.JwtPayload).sub).toBe(userId);
  });

  it('sets an expiry on the token', () => {
    const payload = jwt.decode(signToken(userId)) as jwt.JwtPayload;
    expect(payload.exp).toBeGreaterThan(payload.iat as number);
  });

  it('verifyToken returns the user id for a valid token', () => {
    expect(verifyToken(signToken(userId))).toBe(userId);
  });

  it('verifyToken rejects a token signed with another secret', () => {
    const token = jwt.sign({ sub: userId }, 'some-other-secret');
    expect(() => verifyToken(token)).toThrow();
  });

  it('verifyToken rejects an expired token', () => {
    const token = jwt.sign({ sub: userId }, process.env.JWT_SECRET as string, { expiresIn: -10 });
    expect(() => verifyToken(token)).toThrow();
  });

  it('verifyToken rejects a token without `sub`', () => {
    const token = jwt.sign({ foo: 'bar' }, process.env.JWT_SECRET as string);
    expect(() => verifyToken(token)).toThrow();
  });
});

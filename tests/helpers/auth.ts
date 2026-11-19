import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';

/** Signs a token for the given user id (random if omitted). Replace/extend once A1 adds real users. */
export function signTestToken(userId: string = new mongoose.Types.ObjectId().toString()) {
  const token = jwt.sign({ sub: userId }, process.env.JWT_SECRET as string, { expiresIn: '1h' });
  return { userId, token, authHeader: `Bearer ${token}` };
}

import { model, Schema } from 'mongoose';

export interface IUser {
  username: string;
  email: string;
  passwordHash: string;
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<IUser>(
  {
    username: { type: String, required: true, unique: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    // select: false -> never loaded unless a query explicitly asks for '+passwordHash'
    passwordHash: { type: String, required: true, select: false },
  },
  { timestamps: true },
);

export const User = model<IUser>('User', userSchema);

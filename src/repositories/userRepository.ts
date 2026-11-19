import { User } from '../models/User';

export interface CreateUserData {
  username: string;
  email: string;
  passwordHash: string;
}

export const userRepository = {
  async create(data: CreateUserData) {
    return User.create(data);
  },

  /** Finds a user that already uses this email OR this username. */
  async findByEmailOrUsername(email: string, username: string) {
    return User.findOne({ $or: [{ email }, { username }] }).exec();
  },

  /** Same as a normal lookup by email, but also loads the (normally hidden) passwordHash. */
  async findByEmailWithPassword(email: string) {
    return User.findOne({ email }).select('+passwordHash').exec();
  },

  async findById(id: string) {
    return User.findById(id).exec();
  },
};

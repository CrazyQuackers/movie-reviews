import mongoose from 'mongoose';
import { clearTestDb, startTestDb, stopTestDb } from '../helpers/db';

beforeAll(startTestDb);
afterEach(clearTestDb);
afterAll(stopTestDb);

describe('test database helper', () => {
  it('connects to an in-memory MongoDB', () => {
    expect(mongoose.connection.readyState).toBe(1);
  });
});

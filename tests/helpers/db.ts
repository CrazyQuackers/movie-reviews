import os from 'os';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

let mongod: MongoMemoryServer | undefined;

export async function startTestDb(): Promise<void> {
  mongod = await MongoMemoryServer.create();
  // runtimeAdapters: Jest can't run the driver's dynamic `import('os')`, which makes the
  // handshake metadata invalid ("Missing required sub-document 'driver'"). Pass os explicitly.
  await mongoose.connect(mongod.getUri(), { runtimeAdapters: { os } } as mongoose.ConnectOptions);
}

export async function clearTestDb(): Promise<void> {
  const collections = mongoose.connection.collections;
  await Promise.all(Object.values(collections).map((c) => c.deleteMany({})));
}

export async function stopTestDb(): Promise<void> {
  await mongoose.disconnect();
  await mongod?.stop();
}

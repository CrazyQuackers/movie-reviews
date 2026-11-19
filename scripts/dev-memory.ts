/**
 * Starts the API with a local MongoDB managed by mongodb-memory-server, so you can try it
 * (e.g. in Swagger) without installing MongoDB.
 *
 * Data is saved to disk and survives restarts:
 *   - folder: DEV_DB_PATH, default ~/.movie-reviews-dev-db (in your user folder, outside the
 *     project, so it is never committed and the path has no special characters for mongod)
 *   - port:   DEV_DB_PORT, default 27018 (not 27017, so it can't clash with a real MongoDB)
 * Connect Compass/mongosh to mongodb://127.0.0.1:27018/movie-reviews while the server runs.
 * To start from an empty database, stop the server and delete that folder.
 *
 * Usage: npm run dev:memory
 */
import fs from 'fs';
import os from 'os';
import path from 'path';
import { MongoMemoryServer } from 'mongodb-memory-server';

const dbPath = process.env.DEV_DB_PATH ?? path.join(os.homedir(), '.movie-reviews-dev-db');
const port = Number(process.env.DEV_DB_PORT ?? 27018);

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** On restart the previous mongod may still be releasing the port/files, so retry a few times. */
async function startMongo(): Promise<MongoMemoryServer> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await MongoMemoryServer.create({
        instance: { dbPath, port, ip: '127.0.0.1', storageEngine: 'wiredTiger' },
      });
    } catch (err) {
      if (attempt >= 5) throw err;
      console.log(`MongoDB not ready yet (attempt ${attempt}/5), retrying...`);
      await sleep(1000);
    }
  }
}

async function main() {
  fs.mkdirSync(dbPath, { recursive: true });
  const mongod = await startMongo();

  // Must be set before src/config/env is loaded.
  process.env.MONGO_URI = mongod.getUri('movie-reviews');
  console.log(`MongoDB running at ${process.env.MONGO_URI}`);
  console.log(`Data folder (kept between restarts): ${dbPath}`);

  // Shut mongod down cleanly on Ctrl+C. doCleanup: false keeps the data folder.
  const shutdown = async () => {
    await mongod.stop({ doCleanup: false });
    process.exit(0);
  };
  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);

  await import('../src/server');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

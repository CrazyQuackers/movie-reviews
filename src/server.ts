import app from './app';
import { connectDb } from './config/db';
import { env } from './config/env';
import { documentedPathCount } from './config/swagger';

async function main() {
  await connectDb();
  app.listen(env.port, () => {
    console.log(`Listening on http://localhost:${env.port}`);
    console.log(`Swagger UI: http://localhost:${env.port}/api-docs (${documentedPathCount()} documented paths)`);
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

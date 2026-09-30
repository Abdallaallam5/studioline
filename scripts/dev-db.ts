/**
 * Local MongoDB for development, for when you don't want to point at Atlas.
 * Data persists in ./.data/mongo between runs. Not for production.
 *
 *   npm run db:dev      → mongodb://127.0.0.1:27017/studioline
 */
import { mkdirSync } from "node:fs";
import path from "node:path";
import { MongoMemoryServer } from "mongodb-memory-server";

async function main() {
  const dbPath = path.join(process.cwd(), ".data", "mongo");
  mkdirSync(dbPath, { recursive: true });

  const server = await MongoMemoryServer.create({
    // A small, older server build keeps the one-time download manageable (~280 MB instead of ~780 MB).
    // It is only for local development; production runs on Atlas. Override with MONGOMS_VERSION.
    binary: { version: process.env.MONGOMS_VERSION ?? "4.4.29" },
    instance: { port: 27017, ip: "127.0.0.1", dbPath, storageEngine: "wiredTiger" },
  });

  console.log(`\nMongoDB is running at ${server.getUri()}studioline`);
  console.log("Data directory: .data/mongo — press Ctrl+C to stop.\n");

  const stop = async () => {
    // Keep the data files so the next run picks up where this one left off.
    await server.stop({ doCleanup: false });
    process.exit(0);
  };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

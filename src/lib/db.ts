import "server-only";
import mongoose from "mongoose";
import { env } from "./env";

type Cache = { conn: typeof mongoose | null; promise: Promise<typeof mongoose> | null };

// Reuse the connection across hot reloads and warm serverless invocations.
const globalForDb = globalThis as unknown as { __mongoose?: Cache };
const cache: Cache = globalForDb.__mongoose ?? { conn: null, promise: null };
globalForDb.__mongoose = cache;

export async function connectDb(): Promise<typeof mongoose> {
  if (cache.conn) return cache.conn;
  if (!cache.promise) {
    mongoose.set("strictQuery", true);
    cache.promise = mongoose.connect(env().MONGODB_URI, {
      bufferCommands: false,
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 8000,
    });
  }
  try {
    cache.conn = await cache.promise;
  } catch (err) {
    cache.promise = null;
    throw err;
  }
  return cache.conn;
}

import mongoose, { Connection } from "mongoose";

const MONGODB_URI = process.env.URI_MONGODB as string;

if (!MONGODB_URI) {
  throw new Error("❌ Missing environment variable: URI_MONGODB");
}

let cached = (global as any).mongoose as {
  conn: Connection | null;
  promise: Promise<Connection> | null;
};

if (!cached) {
  cached = (global as any).mongoose = { conn: null, promise: null };
}

export async function connectDB(): Promise<Connection> {
  if (cached.conn) {
    return cached.conn;
  }

  if (!cached.promise) {
    cached.promise = mongoose
      .connect(MONGODB_URI)
      .then((mongooseInstance) => {
        console.log("✅ Connected to MongoDB successfully");
        return mongooseInstance.connection;
      })
      .catch((error) => {
        console.error("❌ MongoDB connection error:", error);
        throw error;
      });
  }

  cached.conn = await cached.promise;
  return cached.conn;
}

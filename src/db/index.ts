import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is not set");
}

/**
 * Reuse a single postgres client across hot reloads in dev to avoid
 * exhausting connections (Next.js HMR re-evaluates modules).
 */
const globalForDb = globalThis as unknown as {
  _tonysdClient?: ReturnType<typeof postgres>;
};

const client =
  globalForDb._tonysdClient ??
  postgres(connectionString, {
    max: 10,
    // Local PG has no SSL; set PGSSL_DISABLE=1 to force sslmode=disable.
    ssl: process.env.PGSSL_DISABLE === "1" ? false : undefined,
  });

if (process.env.NODE_ENV !== "production") {
  globalForDb._tonysdClient = client;
}

export const db = drizzle(client, { schema });
export { schema };

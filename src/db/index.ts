import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { config } from "../config/env";
import * as schema from "./schema";

const connectionString =
  config.databaseUrl || "postgres://postgres:postgres@localhost:5432/fintrack";

// Postgres client instance (lazy connection on first query)
export const client = postgres(connectionString, {
  max: 10,
  idle_timeout: 20,
  connect_timeout: 10,
});

// Drizzle ORM instance
export const db = drizzle(client, { schema });
export type Database = typeof db;

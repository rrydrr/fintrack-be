import { pgSchema } from "drizzle-orm/pg-core";

/**
 * Domain-separated PostgreSQL schemas for FinTrack.
 * Avoids putting application tables into PostgreSQL's default public schema.
 */
export const authSchema = pgSchema("auth");
export const financeSchema = pgSchema("finance");

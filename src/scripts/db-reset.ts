import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { client } from "../db";
import { logger } from "../utils/logger";

async function askConfirmation(): Promise<boolean> {
  // Support --force or -y flag for non-interactive / CI automation
  if (process.argv.includes("--force") || process.argv.includes("-y")) {
    return true;
  }

  const rl = readline.createInterface({ input, output });
  try {
    const answer = await rl.question(
      "\x1b[33m⚠️  CAUTION: This will DROP all tables across auth, finance, and public schemas!\nAre you sure you want to proceed? (y/N): \x1b[0m"
    );
    const normalized = answer.trim().toLowerCase();
    return normalized === "y" || normalized === "yes";
  } finally {
    rl.close();
  }
}

async function resetDatabase() {
  const confirmed = await askConfirmation();

  if (!confirmed) {
    logger.info("Database reset cancelled by user.");
    await client.end();
    process.exit(0);
  }

  logger.warn("⚠️  Starting database reset...");

  try {
    // Drop all tables across auth, finance, and public schemas cleanly with CASCADE
    await client.unsafe(`
      DO $$ DECLARE
        r RECORD;
      BEGIN
        FOR r IN (
          SELECT schemaname, tablename 
          FROM pg_tables 
          WHERE schemaname IN ('auth', 'finance', 'public')
        ) LOOP
          EXECUTE 'DROP TABLE IF EXISTS ' || quote_ident(r.schemaname) || '.' || quote_ident(r.tablename) || ' CASCADE';
        END LOOP;
      END $$;
    `);

    logger.success("✅ Database reset complete: All tables dropped across schemas.");
    logger.info("ℹ️  Run 'bun run db:push' to re-apply your Drizzle schema.");
  } catch (error: any) {
    logger.error("❌ Failed to reset database:", error.message || error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

resetDatabase();

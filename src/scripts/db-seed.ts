import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { client, db } from "../db";
import { logger } from "../utils/logger";

async function askConfirmation(): Promise<boolean> {
  // Support --force or -y flag for non-interactive / CI automation
  if (process.argv.includes("--force") || process.argv.includes("-y")) {
    return true;
  }

  const rl = readline.createInterface({ input, output });
  try {
    const answer = await rl.question(
      "\x1b[33m🌱 Are you sure you want to run the database seed script? (y/N): \x1b[0m"
    );
    const normalized = answer.trim().toLowerCase();
    return normalized === "y" || normalized === "yes";
  } finally {
    rl.close();
  }
}

async function seed() {
  const confirmed = await askConfirmation();

  if (!confirmed) {
    logger.info("Database seeding cancelled by user.");
    await client.end();
    process.exit(0);
  }

  logger.info("🌱 Starting database seeding...");

  try {
    // Add your seed data insertion logic here
    // Example:
    // await db.insert(receipts).values([...]);

    logger.success("✅ Database seeding completed successfully (no seed data configured yet).");
  } catch (error: any) {
    logger.error("❌ Database seeding failed:", error.message || error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

seed();

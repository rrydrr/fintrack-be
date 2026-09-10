import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { client, db } from "../db";
import { users, UserRole } from "../db/schema";
import { logger } from "../utils/logger";

interface SeedUser {
  name: string;
  email: string;
  password: string;
  role: UserRole;
}

const SEED_USERS: SeedUser[] = [
  {
    name: "Admin FinTrack",
    email: "admin@fintrack.local",
    password: "ChangeMe123!",
    role: "admin",
  },
  {
    name: "Demo User",
    email: "demo@fintrack.local",
    password: "ChangeMe123!",
    role: "user",
  },
];

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
    logger.info(`Seeding ${SEED_USERS.length} demo users...`);

    for (const seedUser of SEED_USERS) {
      const passwordHash = await Bun.password.hash(seedUser.password, {
        algorithm: "bcrypt",
        cost: 10,
      });

      const [record] = await db
        .insert(users)
        .values({
          name: seedUser.name,
          email: seedUser.email.toLowerCase().trim(),
          passwordHash,
          role: seedUser.role,
        })
        .onConflictDoUpdate({
          target: users.email,
          set: {
            role: seedUser.role,
            name: seedUser.name,
            passwordHash,
          },
        })
        .returning({ id: users.id, email: users.email, role: users.role });

      logger.success(`Seeded user: ${record.email} (Role: ${record.role}, ID: ${record.id})`);
    }

    logger.success("✅ Database seeding completed successfully!");
    console.log("\n=================== SEED CREDENTIALS ===================");
    for (const user of SEED_USERS) {
      console.log(`👤 Name:     ${user.name}`);
      console.log(`📧 Email:    ${user.email}`);
      console.log(`🔑 Password: ${user.password}`);
      console.log(`🛡️  Role:     ${user.role}`);
      console.log("--------------------------------------------------------");
    }
    console.log("========================================================\n");
  } catch (error: any) {
    logger.error("❌ Database seeding failed:", error.message || error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

seed();

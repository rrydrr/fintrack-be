import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { client, db } from "../db";
import {
  users,
  currencies,
  exchangeRates,
  accountTypeTemplates,
  accountTypes,
  accounts,
  UserRole,
} from "../db/schema";
import { accountTypeService } from "../modules/account-type/account-type.service";
import { logger } from "../utils/logger";
import { config } from "../config/env";
import { and, eq, isNull } from "drizzle-orm";

interface SeedUser {
  name: string;
  email: string;
  password: string;
  role: UserRole;
  defaultCurrency: string;
}

const SEED_USERS: SeedUser[] = [
  {
    name: "Admin FinTrack",
    email: config.seedAdminEmail,
    password: config.seedAdminPassword,
    role: "admin",
    defaultCurrency: "IDR",
  },
  {
    name: "Demo User",
    email: "demo@fintrack.local",
    password: "ChangeMe123!",
    role: "user",
    defaultCurrency: "IDR",
  },
];

const SEED_CURRENCIES = [
  { code: "IDR", name: "Indonesian Rupiah", symbol: "Rp", symbolPosition: "prefix" as const, decimalDigits: 0, isBase: true },
  { code: "USD", name: "US Dollar", symbol: "$", symbolPosition: "prefix" as const, decimalDigits: 2, isBase: false },
  { code: "SGD", name: "Singapore Dollar", symbol: "S$", symbolPosition: "prefix" as const, decimalDigits: 2, isBase: false },
  { code: "EUR", name: "Euro", symbol: "€", symbolPosition: "prefix" as const, decimalDigits: 2, isBase: false },
  { code: "JPY", name: "Japanese Yen", symbol: "¥", symbolPosition: "prefix" as const, decimalDigits: 0, isBase: false },
  { code: "GBP", name: "British Pound", symbol: "£", symbolPosition: "prefix" as const, decimalDigits: 2, isBase: false },
];

const SEED_EXCHANGE_RATES = [
  { fromCurrency: "USD", toCurrency: "IDR", rate: "16000.00000000" },
  { fromCurrency: "SGD", toCurrency: "IDR", rate: "12200.00000000" },
  { fromCurrency: "EUR", toCurrency: "IDR", rate: "17500.00000000" },
  { fromCurrency: "JPY", toCurrency: "IDR", rate: "105.00000000" },
  { fromCurrency: "GBP", toCurrency: "IDR", rate: "20500.00000000" },
];

const SEED_TEMPLATES = [
  {
    name: "Tunai",
    code: "cash",
    nature: "asset" as const,
    description: "Uang tunai fisik, kas kecil, dompet harian",
    icon: "wallet",
    color: "#10B981",
    displayOrder: 1,
  },
  {
    name: "Tabungan",
    code: "savings",
    nature: "asset" as const,
    description: "Rekening tabungan bank, deposito, dana darurat",
    icon: "piggy-bank",
    color: "#3B82F6",
    displayOrder: 2,
  },
  {
    name: "Kartu Debit",
    code: "debit_card",
    nature: "asset" as const,
    description: "Rekening giro, kartu debit, dompet digital operasional",
    icon: "credit-card",
    color: "#06B6D4",
    displayOrder: 3,
  },
  {
    name: "Kartu Kredit",
    code: "credit_card",
    nature: "liability" as const,
    description: "Fasilitas kartu kredit dan paylater",
    icon: "credit-card",
    color: "#EF4444",
    displayOrder: 4,
  },
  {
    name: "Pinjaman",
    code: "loan",
    nature: "liability" as const,
    description: "KPR, pinjaman bank, kredit kendaraan bermotor",
    icon: "receipt-tax",
    color: "#F59E0B",
    displayOrder: 5,
  },
  {
    name: "Investasi & Aset",
    code: "asset",
    nature: "asset" as const,
    description: "Saham, reksadana, emas, properti, crypto",
    icon: "trending-up",
    color: "#8B5CF6",
    displayOrder: 6,
  },
];

async function askConfirmation(): Promise<boolean> {
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
    // 1. Ensure schemas exist
    await client.unsafe(`
      CREATE SCHEMA IF NOT EXISTS auth;
      CREATE SCHEMA IF NOT EXISTS finance;
    `);
    logger.info("Ensured 'auth' and 'finance' schemas exist.");

    // 2. Seed universal currencies
    logger.info("Seeding universal currencies...");
    for (const c of SEED_CURRENCIES) {
      const existing = await db
        .select({ id: currencies.id })
        .from(currencies)
        .where(and(isNull(currencies.userId), eq(currencies.code, c.code)))
        .limit(1);

      if (existing.length === 0) {
        await db.insert(currencies).values({
          userId: null,
          code: c.code,
          name: c.name,
          symbol: c.symbol,
          symbolPosition: c.symbolPosition,
          decimalDigits: c.decimalDigits,
          isBase: c.isBase,
          isSystem: true,
          isActive: true,
        });
      }
    }
    logger.success("Universal currencies seeded successfully (IDR Base).");

    // 3. Seed universal exchange rates
    logger.info("Seeding system exchange rates...");
    for (const rate of SEED_EXCHANGE_RATES) {
      const existing = await db
        .select({ id: exchangeRates.id })
        .from(exchangeRates)
        .where(
          and(
            isNull(exchangeRates.userId),
            eq(exchangeRates.fromCurrency, rate.fromCurrency),
            eq(exchangeRates.toCurrency, rate.toCurrency)
          )
        )
        .limit(1);

      if (existing.length === 0) {
        await db.insert(exchangeRates).values({
          userId: null,
          fromCurrency: rate.fromCurrency,
          toCurrency: rate.toCurrency,
          rate: rate.rate,
        });
      }
    }
    logger.success("System exchange rates seeded successfully.");

    // 4. Seed master account type templates
    logger.info("Seeding master account type templates...");
    for (const tpl of SEED_TEMPLATES) {
      const existing = await db
        .select({ id: accountTypeTemplates.id })
        .from(accountTypeTemplates)
        .where(eq(accountTypeTemplates.code, tpl.code))
        .limit(1);

      if (existing.length === 0) {
        await db.insert(accountTypeTemplates).values({
          name: tpl.name,
          code: tpl.code,
          nature: tpl.nature,
          description: tpl.description,
          icon: tpl.icon,
          color: tpl.color,
          displayOrder: tpl.displayOrder,
          isActive: true,
        });
      }
    }
    logger.success("Master account type templates seeded successfully.");

    // 5. Seed demo users
    logger.info(`Seeding ${SEED_USERS.length} demo users...`);
    const seededUserRecords: any[] = [];

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
          defaultCurrency: seedUser.defaultCurrency,
        })
        .onConflictDoUpdate({
          target: users.email,
          set: {
            role: seedUser.role,
            name: seedUser.name,
            passwordHash,
            defaultCurrency: seedUser.defaultCurrency,
          },
        })
        .returning({
          id: users.id,
          email: users.email,
          role: users.role,
          name: users.name,
          defaultCurrency: users.defaultCurrency,
        });

      seededUserRecords.push(record);
      logger.success(`Seeded user: ${record.email} (Role: ${record.role}, ID: ${record.id})`);

      // 6. Provision user-bound account types for seeded users
      await accountTypeService.seedUserAccountTypes(record.id);
    }

    // 7. Seed demo custom currency and accounts for Demo User
    const demoUser = seededUserRecords.find((u) => u.role === "user");
    if (demoUser) {
      logger.info("Seeding custom crypto currency and sample accounts for Demo User...");

      // Custom Currency: BTC
      const [customBtc] = await db
        .insert(currencies)
        .values({
          userId: demoUser.id,
          code: "BTC",
          name: "Bitcoin",
          symbol: "₿",
          symbolPosition: "prefix",
          decimalDigits: 8,
          isBase: false,
          isSystem: false,
          isActive: true,
        })
        .onConflictDoNothing()
        .returning();

      // Custom Rate: BTC -> IDR = 1,050,000,000
      await db
        .insert(exchangeRates)
        .values({
          userId: demoUser.id,
          fromCurrency: "BTC",
          toCurrency: "IDR",
          rate: "1050000000.00000000",
        })
        .onConflictDoNothing();

      // Query user's account types
      const userTypes = await db
        .select()
        .from(accountTypes)
        .where(eq(accountTypes.userId, demoUser.id));

      const cashType = userTypes.find((t) => t.code === "cash");
      const savingsType = userTypes.find((t) => t.code === "savings");
      const cardType = userTypes.find((t) => t.code === "credit_card");
      const loanType = userTypes.find((t) => t.code === "loan");
      const assetType = userTypes.find((t) => t.code === "asset");

      // Seed Accounts if user has no accounts yet
      const existingAccounts = await db
        .select({ id: accounts.id })
        .from(accounts)
        .where(eq(accounts.userId, demoUser.id));

      if (existingAccounts.length === 0) {
        if (cashType) {
          await db.insert(accounts).values({
            userId: demoUser.id,
            accountTypeId: cashType.id,
            currencyCode: "IDR",
            name: "Dompet Tunai",
            institutionName: "Cash",
            initialBalance: "250000.00",
            currentBalance: "250000.00",
          });
        }

        if (savingsType) {
          await db.insert(accounts).values({
            userId: demoUser.id,
            accountTypeId: savingsType.id,
            currencyCode: "IDR",
            name: "BCA Tabungan Utama",
            institutionName: "BCA",
            accountNumber: "4532",
            initialBalance: "15000000.00",
            currentBalance: "15000000.00",
          });
        }

        if (cardType) {
          await db.insert(accounts).values({
            userId: demoUser.id,
            accountTypeId: cardType.id,
            currencyCode: "IDR",
            name: "Mandiri Kartu Kredit",
            institutionName: "Bank Mandiri",
            accountNumber: "8899",
            initialBalance: "0.00",
            currentBalance: "1500000.00",
            creditLimit: "20000000.00",
            paymentDate: "10",
            dueDate: "25",
          });
        }

        if (loanType) {
          await db.insert(accounts).values({
            userId: demoUser.id,
            accountTypeId: loanType.id,
            currencyCode: "IDR",
            name: "KPR Rumah",
            institutionName: "Bank BCA",
            accountNumber: "KPR-9921",
            initialBalance: "500000000.00",
            currentBalance: "450000000.00",
            interestRate: "7.50",
            paymentDate: "1",
            dueDate: "5",
          });
        }

        if (assetType) {
          await db.insert(accounts).values({
            userId: demoUser.id,
            accountTypeId: assetType.id,
            currencyCode: "BTC",
            name: "Indodax Bitcoin",
            institutionName: "Indodax",
            initialBalance: "0.01500000",
            currentBalance: "0.01500000",
          });
        }

        logger.success("Sample accounts seeded for Demo User.");
      }
    }

    logger.success("✅ Complete database seeding completed successfully!");
    console.log("\n=================== SEED CREDENTIALS ===================");
    for (const user of SEED_USERS) {
      console.log(`👤 Name:             ${user.name}`);
      console.log(`📧 Email:            ${user.email}`);
      console.log(`🔑 Password:         ${user.password}`);
      console.log(`🛡️  Role:             ${user.role}`);
      console.log(`💵 Default Currency: ${user.defaultCurrency}`);
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

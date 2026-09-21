import { uuid, text, timestamp } from "drizzle-orm/pg-core";
import { authSchema } from "../schemas";

export const userRoleEnum = authSchema.enum("user_role", ["admin", "user"]);
export type UserRole = "admin" | "user";

export const users = authSchema.table("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  name: text("name").notNull(),
  role: userRoleEnum("role").default("user").notNull(),
  defaultCurrency: text("default_currency").default("IDR").notNull(),
  emailVerifiedAt: timestamp("email_verified_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

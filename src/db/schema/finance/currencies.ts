import { uuid, text, integer, boolean, timestamp, index } from "drizzle-orm/pg-core";
import { financeSchema } from "../schemas";
import { users } from "../auth/users";

export const currencies = financeSchema.table(
  "currencies",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
    code: text("code").notNull(),
    name: text("name").notNull(),
    symbol: text("symbol").notNull(),
    symbolPosition: text("symbol_position").default("prefix").notNull(),
    decimalDigits: integer("decimal_digits").default(0).notNull(),
    isBase: boolean("is_base").default(false).notNull(),
    isSystem: boolean("is_system").default(false).notNull(),
    isActive: boolean("is_active").default(true).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("currencies_user_id_idx").on(table.userId),
    index("currencies_code_idx").on(table.code),
  ]
);

export type Currency = typeof currencies.$inferSelect;
export type NewCurrency = typeof currencies.$inferInsert;

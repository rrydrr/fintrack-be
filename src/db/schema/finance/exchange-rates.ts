import { uuid, text, numeric, timestamp, index } from "drizzle-orm/pg-core";
import { financeSchema } from "../schemas";
import { users } from "../auth/users";

export const exchangeRates = financeSchema.table(
  "exchange_rates",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
    fromCurrency: text("from_currency").notNull(),
    toCurrency: text("to_currency").default("IDR").notNull(),
    rate: numeric("rate", { precision: 24, scale: 8 }).notNull(),
    effectiveDate: timestamp("effective_date").defaultNow().notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("exchange_rates_user_id_idx").on(table.userId),
    index("exchange_rates_pair_idx").on(table.fromCurrency, table.toCurrency),
  ]
);

export type ExchangeRate = typeof exchangeRates.$inferSelect;
export type NewExchangeRate = typeof exchangeRates.$inferInsert;

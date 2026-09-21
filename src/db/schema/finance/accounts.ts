import { uuid, text, numeric, boolean, timestamp, index } from "drizzle-orm/pg-core";
import { financeSchema } from "../schemas";
import { users } from "../auth/users";
import { accountTypes } from "./account-types";

export const accounts = financeSchema.table(
  "accounts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    accountTypeId: uuid("account_type_id")
      .references(() => accountTypes.id, { onDelete: "restrict" })
      .notNull(),
    currencyCode: text("currency_code").default("IDR").notNull(),
    name: text("name").notNull(),
    institutionName: text("institution_name"),
    accountNumber: text("account_number"),
    currentBalance: numeric("current_balance", { precision: 24, scale: 8 })
      .default("0.00")
      .notNull(),
    initialBalance: numeric("initial_balance", { precision: 24, scale: 8 })
      .default("0.00")
      .notNull(),
    creditLimit: numeric("credit_limit", { precision: 14, scale: 2 }),
    interestRate: numeric("interest_rate", { precision: 5, scale: 2 }),
    paymentDate: text("payment_date"), // e.g. billing/payment date or day of month (for credit cards/loans)
    dueDate: text("due_date"), // e.g. payment due date or day of month (for credit cards/loans)
    color: text("color"),
    icon: text("icon"),
    notes: text("notes"),
    isExcludedFromNetWorth: boolean("is_excluded_from_net_worth").default(false).notNull(),
    isArchived: boolean("is_archived").default(false).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("accounts_user_id_idx").on(table.userId),
    index("accounts_type_id_idx").on(table.accountTypeId),
  ]
);

export type Account = typeof accounts.$inferSelect;
export type NewAccount = typeof accounts.$inferInsert;

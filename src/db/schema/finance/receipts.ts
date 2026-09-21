import { uuid, text, numeric, jsonb, timestamp } from "drizzle-orm/pg-core";
import { financeSchema } from "../schemas";
import { users } from "../auth/users";

export const receipts = financeSchema.table("receipts", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  merchantName: text("merchant_name"),
  transactionDate: text("transaction_date"),
  totalAmount: numeric("total_amount", { precision: 12, scale: 2 }),
  currency: text("currency"),
  parsedData: jsonb("parsed_data"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

export type Receipt = typeof receipts.$inferSelect;
export type NewReceipt = typeof receipts.$inferInsert;

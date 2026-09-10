import { pgTable, uuid, text, numeric, jsonb, timestamp } from "drizzle-orm/pg-core";

export const receipts = pgTable("receipts", {
  id: uuid("id").defaultRandom().primaryKey(),
  merchantName: text("merchant_name"),
  transactionDate: text("transaction_date"),
  totalAmount: numeric("total_amount", { precision: 12, scale: 2 }),
  currency: text("currency"),
  parsedData: jsonb("parsed_data"),
  rawResponse: jsonb("raw_response"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

export type Receipt = typeof receipts.$inferSelect;
export type NewReceipt = typeof receipts.$inferInsert;

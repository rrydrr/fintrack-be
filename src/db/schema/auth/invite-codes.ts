import { uuid, text, timestamp, index } from "drizzle-orm/pg-core";
import { authSchema } from "../schemas";
import { users } from "./users";

export const inviteCodes = authSchema.table(
  "invite_codes",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    code: text("code").notNull().unique(),
    createdBy: uuid("created_by")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    usedBy: uuid("used_by").references(() => users.id, { onDelete: "set null" }),
    expiresAt: timestamp("expires_at").notNull(),
    usedAt: timestamp("used_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("invite_codes_code_idx").on(table.code),
    index("invite_codes_created_by_idx").on(table.createdBy),
  ]
);

export type InviteCode = typeof inviteCodes.$inferSelect;
export type NewInviteCode = typeof inviteCodes.$inferInsert;

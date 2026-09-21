import { uuid, text, integer, boolean, timestamp, index } from "drizzle-orm/pg-core";
import { financeSchema } from "../schemas";
import { users } from "../auth/users";

export type AccountNature = "asset" | "liability";

export const accountTypeTemplates = financeSchema.table(
  "account_type_templates",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: text("name").notNull(),
    code: text("code").notNull().unique(),
    nature: text("nature").notNull(),
    description: text("description"),
    icon: text("icon"),
    color: text("color"),
    displayOrder: integer("display_order").default(0).notNull(),
    isActive: boolean("is_active").default(true).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [index("account_type_templates_code_idx").on(table.code)]
);

export type AccountTypeTemplate = typeof accountTypeTemplates.$inferSelect;
export type NewAccountTypeTemplate = typeof accountTypeTemplates.$inferInsert;

export const accountTypes = financeSchema.table(
  "account_types",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    templateId: uuid("template_id").references(() => accountTypeTemplates.id, {
      onDelete: "set null",
    }),
    name: text("name").notNull(),
    code: text("code").notNull(),
    nature: text("nature").notNull(),
    description: text("description"),
    icon: text("icon"),
    color: text("color"),
    displayOrder: integer("display_order").default(0).notNull(),
    isArchived: boolean("is_archived").default(false).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("account_types_user_id_idx").on(table.userId),
    index("account_types_user_code_idx").on(table.userId, table.code),
  ]
);

export type AccountType = typeof accountTypes.$inferSelect;
export type NewAccountType = typeof accountTypes.$inferInsert;

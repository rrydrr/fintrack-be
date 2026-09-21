import { and, asc, eq } from "drizzle-orm";
import { db } from "../../db";
import {
  accountTypes,
  accountTypeTemplates,
  AccountType,
  AccountTypeTemplate,
  AccountNature,
} from "../../db/schema";
import { paginateArray, PaginationMeta } from "../../utils/pagination";
import { logger } from "../../utils/logger";
import { SafeUser } from "../auth/auth.service";

export class AccountTypeService {
  /**
   * Format account type DB entity into client response.
   */
  private formatAccountType(record: AccountType) {
    return {
      ...record,
      nature: record.nature as AccountNature,
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString(),
    };
  }

  /**
   * Format account type template DB entity into client response.
   */
  private formatTemplate(record: AccountTypeTemplate) {
    return {
      ...record,
      nature: record.nature as AccountNature,
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString(),
    };
  }

  /**
   * Automatically provision initial account types for a user cloned from active master templates.
   */
  public async seedUserAccountTypes(userId: string): Promise<AccountType[]> {
    const templates = await db
      .select()
      .from(accountTypeTemplates)
      .where(eq(accountTypeTemplates.isActive, true))
      .orderBy(asc(accountTypeTemplates.displayOrder));

    if (templates.length === 0) {
      logger.warn("No active account type templates found to seed for user", { userId });
      return [];
    }

    const inserted: AccountType[] = [];

    for (const tpl of templates) {
      const [record] = await db
        .insert(accountTypes)
        .values({
          userId,
          templateId: tpl.id,
          name: tpl.name,
          code: tpl.code,
          nature: tpl.nature as AccountNature,
          description: tpl.description,
          icon: tpl.icon,
          color: tpl.color,
          displayOrder: tpl.displayOrder,
          isArchived: false,
        })
        .onConflictDoNothing()
        .returning();

      if (record) {
        inserted.push(record);
      }
    }

    logger.success(`Provisioned ${inserted.length} account types for user`, { userId });
    return inserted;
  }

  /**
   * Sync missing master templates into the user's account types.
   */
  public async syncTemplatesForUser(user: SafeUser) {
    const templates = await db
      .select()
      .from(accountTypeTemplates)
      .where(eq(accountTypeTemplates.isActive, true));

    const existingTypes = await db
      .select({ code: accountTypes.code })
      .from(accountTypes)
      .where(eq(accountTypes.userId, user.id));

    const existingCodes = new Set(existingTypes.map((t) => t.code.toLowerCase()));
    const missingTemplates = templates.filter((tpl) => !existingCodes.has(tpl.code.toLowerCase()));

    const newlySynced: AccountType[] = [];

    for (const tpl of missingTemplates) {
      const [record] = await db
        .insert(accountTypes)
        .values({
          userId: user.id,
          templateId: tpl.id,
          name: tpl.name,
          code: tpl.code,
          nature: tpl.nature as AccountNature,
          description: tpl.description,
          icon: tpl.icon,
          color: tpl.color,
          displayOrder: tpl.displayOrder,
          isArchived: false,
        })
        .returning();

      if (record) {
        newlySynced.push(record);
      }
    }

    return {
      syncedCount: newlySynced.length,
      data: newlySynced.map((r) => this.formatAccountType(r)),
    };
  }

  /**
   * List account types (or master templates if isTemplate=true and Admin).
   */
  public async listAccountTypes(
    user: SafeUser,
    query?: {
      nature?: AccountNature;
      includeArchived?: boolean;
      isTemplate?: boolean;
      page?: number;
      limit?: number;
    }
  ): Promise<{ data: any[]; pagination?: PaginationMeta }> {
    // If admin requested master templates
    if (query?.isTemplate && user.role === "admin") {
      const rawTemplates = await db
        .select()
        .from(accountTypeTemplates)
        .where(query?.nature ? eq(accountTypeTemplates.nature, query.nature) : undefined)
        .orderBy(asc(accountTypeTemplates.displayOrder), accountTypeTemplates.name);

      const formatted = rawTemplates.map((t) => this.formatTemplate(t));
      return paginateArray(formatted, query);
    }

    // Default: List user's account types
    const rawList = await db
      .select()
      .from(accountTypes)
      .where(
        and(
          eq(accountTypes.userId, user.id),
          query?.nature ? eq(accountTypes.nature, query.nature) : undefined,
          query?.includeArchived ? undefined : eq(accountTypes.isArchived, false)
        )
      )
      .orderBy(asc(accountTypes.displayOrder), accountTypes.name);

    const formatted = rawList.map((t) => this.formatAccountType(t));
    return paginateArray(formatted, query);
  }

  /**
   * Get single account type by ID.
   */
  public async getAccountTypeById(user: SafeUser, id: string) {
    const [record] = await db
      .select()
      .from(accountTypes)
      .where(and(eq(accountTypes.id, id), eq(accountTypes.userId, user.id)))
      .limit(1);

    if (record) {
      return this.formatAccountType(record);
    }

    // Admin can also fetch master template by ID
    if (user.role === "admin") {
      const [template] = await db
        .select()
        .from(accountTypeTemplates)
        .where(eq(accountTypeTemplates.id, id))
        .limit(1);

      if (template) {
        return this.formatTemplate(template);
      }
    }

    const err: any = new Error("Account type not found");
    err.status = 404;
    throw err;
  }

  /**
   * Create account type.
   * If isTemplate is true and user is admin -> creates a master template.
   * Otherwise -> creates a user-bound custom account type.
   */
  public async createAccountType(
    user: SafeUser,
    payload: {
      name: string;
      code: string;
      nature: AccountNature;
      description?: string;
      icon?: string;
      color?: string;
      displayOrder?: number;
      isTemplate?: boolean;
    }
  ) {
    const code = payload.code.trim().toLowerCase().replace(/[\s-]+/g, "_");

    // Master template creation (Admin only)
    if (payload.isTemplate && user.role === "admin") {
      const [existingTemplate] = await db
        .select({ id: accountTypeTemplates.id })
        .from(accountTypeTemplates)
        .where(eq(accountTypeTemplates.code, code))
        .limit(1);

      if (existingTemplate) {
        const err: any = new Error(`Master template with code '${code}' already exists`);
        err.status = 409;
        throw err;
      }

      const [template] = await db
        .insert(accountTypeTemplates)
        .values({
          name: payload.name.trim(),
          code,
          nature: payload.nature,
          description: payload.description?.trim(),
          icon: payload.icon?.trim(),
          color: payload.color?.trim(),
          displayOrder: payload.displayOrder ?? 0,
          isActive: true,
        })
        .returning();

      logger.success(`Created master account type template ${template.code}`);
      return this.formatTemplate(template);
    }

    // Check conflict for user
    const [existing] = await db
      .select({ id: accountTypes.id })
      .from(accountTypes)
      .where(and(eq(accountTypes.userId, user.id), eq(accountTypes.code, code)))
      .limit(1);

    if (existing) {
      const err: any = new Error(`Account type with code '${code}' already exists`);
      err.status = 409;
      throw err;
    }

    const [created] = await db
      .insert(accountTypes)
      .values({
        userId: user.id,
        name: payload.name.trim(),
        code,
        nature: payload.nature,
        description: payload.description?.trim(),
        icon: payload.icon?.trim(),
        color: payload.color?.trim(),
        displayOrder: payload.displayOrder ?? 0,
        isArchived: false,
      })
      .returning();

    logger.success(`Created account type ${created.name} for user`, { userId: user.id });
    return this.formatAccountType(created);
  }

  /**
   * Update account type or master template.
   */
  public async updateAccountType(
    user: SafeUser,
    id: string,
    payload: {
      name?: string;
      nature?: AccountNature;
      description?: string;
      icon?: string;
      color?: string;
      displayOrder?: number;
      isArchived?: boolean;
      isActive?: boolean;
    }
  ) {
    // 1. Check user account type
    const [userType] = await db
      .select()
      .from(accountTypes)
      .where(and(eq(accountTypes.id, id), eq(accountTypes.userId, user.id)))
      .limit(1);

    if (userType) {
      const [updated] = await db
        .update(accountTypes)
        .set({
          name: payload.name ? payload.name.trim() : undefined,
          nature: payload.nature,
          description: payload.description !== undefined ? payload.description : undefined,
          icon: payload.icon !== undefined ? payload.icon : undefined,
          color: payload.color !== undefined ? payload.color : undefined,
          displayOrder: payload.displayOrder,
          isArchived: payload.isArchived,
        })
        .where(eq(accountTypes.id, id))
        .returning();

      return this.formatAccountType(updated);
    }

    // 2. Check master template if admin
    if (user.role === "admin") {
      const [template] = await db
        .select()
        .from(accountTypeTemplates)
        .where(eq(accountTypeTemplates.id, id))
        .limit(1);

      if (template) {
        const [updatedTemplate] = await db
          .update(accountTypeTemplates)
          .set({
            name: payload.name ? payload.name.trim() : undefined,
            nature: payload.nature,
            description: payload.description !== undefined ? payload.description : undefined,
            icon: payload.icon !== undefined ? payload.icon : undefined,
            color: payload.color !== undefined ? payload.color : undefined,
            displayOrder: payload.displayOrder,
            isActive: payload.isActive,
          })
          .where(eq(accountTypeTemplates.id, id))
          .returning();

        return this.formatTemplate(updatedTemplate);
      }
    }

    const err: any = new Error("Account type not found or permission denied");
    err.status = 404;
    throw err;
  }

  /**
   * Delete account type or master template.
   */
  public async deleteAccountType(user: SafeUser, id: string) {
    const [userType] = await db
      .select()
      .from(accountTypes)
      .where(and(eq(accountTypes.id, id), eq(accountTypes.userId, user.id)))
      .limit(1);

    if (userType) {
      await db.delete(accountTypes).where(eq(accountTypes.id, id));
      return { success: true, message: `Account type '${userType.name}' deleted successfully` };
    }

    if (user.role === "admin") {
      const [template] = await db
        .select()
        .from(accountTypeTemplates)
        .where(eq(accountTypeTemplates.id, id))
        .limit(1);

      if (template) {
        await db.delete(accountTypeTemplates).where(eq(accountTypeTemplates.id, id));
        return { success: true, message: `Master template '${template.name}' deleted successfully` };
      }
    }

    const err: any = new Error("Account type not found");
    err.status = 404;
    throw err;
  }
}

export const accountTypeService = new AccountTypeService();

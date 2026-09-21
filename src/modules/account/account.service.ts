import { and, asc, desc, eq } from "drizzle-orm";
import { db } from "../../db";
import { accounts, accountTypes, Account, AccountType, AccountNature } from "../../db/schema";
import { paginateArray, PaginationMeta } from "../../utils/pagination";
import { logger } from "../../utils/logger";
import { SafeUser } from "../auth/auth.service";
import { currencyService } from "../currency/currency.service";

export class AccountService {
  /**
   * Format account entity into client model.
   */
  private formatAccount(
    record: Account,
    accountType?: {
      id: string;
      name: string;
      code: string;
      nature: string;
      icon: string | null;
      color: string | null;
    }
  ) {
    return {
      ...record,
      currentBalance: record.currentBalance.toString(),
      initialBalance: record.initialBalance.toString(),
      creditLimit: record.creditLimit ? record.creditLimit.toString() : null,
      interestRate: record.interestRate ? record.interestRate.toString() : null,
      accountType: accountType
        ? {
            id: accountType.id,
            name: accountType.name,
            code: accountType.code,
            nature: accountType.nature as AccountNature,
            icon: accountType.icon,
            color: accountType.color,
          }
        : undefined,
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString(),
    };
  }

  /**
   * List all accounts owned by the authenticated user.
   */
  public async listAccounts(
    user: SafeUser,
    query?: {
      accountTypeId?: string;
      nature?: AccountNature;
      currencyCode?: string;
      includeArchived?: boolean;
      page?: number;
      limit?: number;
    }
  ): Promise<{ data: any[]; pagination?: PaginationMeta }> {
    const rawRows = await db
      .select({
        account: accounts,
        accountType: {
          id: accountTypes.id,
          name: accountTypes.name,
          code: accountTypes.code,
          nature: accountTypes.nature,
          icon: accountTypes.icon,
          color: accountTypes.color,
        },
      })
      .from(accounts)
      .innerJoin(accountTypes, eq(accounts.accountTypeId, accountTypes.id))
      .where(
        and(
          eq(accounts.userId, user.id),
          query?.accountTypeId ? eq(accounts.accountTypeId, query.accountTypeId) : undefined,
          query?.currencyCode ? eq(accounts.currencyCode, query.currencyCode.toUpperCase()) : undefined,
          query?.nature ? eq(accountTypes.nature, query.nature) : undefined,
          query?.includeArchived ? undefined : eq(accounts.isArchived, false)
        )
      )
      .orderBy(desc(accounts.createdAt));

    const formatted = rawRows.map((r) => this.formatAccount(r.account, r.accountType));
    return paginateArray(formatted, query);
  }

  /**
   * Get single account details by ID.
   */
  public async getAccountById(user: SafeUser, id: string) {
    const [row] = await db
      .select({
        account: accounts,
        accountType: {
          id: accountTypes.id,
          name: accountTypes.name,
          code: accountTypes.code,
          nature: accountTypes.nature,
          icon: accountTypes.icon,
          color: accountTypes.color,
        },
      })
      .from(accounts)
      .innerJoin(accountTypes, eq(accounts.accountTypeId, accountTypes.id))
      .where(and(eq(accounts.id, id), eq(accounts.userId, user.id)))
      .limit(1);

    if (!row) {
      const err: any = new Error("Account not found");
      err.status = 404;
      throw err;
    }

    return this.formatAccount(row.account, row.accountType);
  }

  /**
   * Create a new financial account.
   */
  public async createAccount(
    user: SafeUser,
    payload: {
      name: string;
      accountTypeId: string;
      currencyCode?: string;
      institutionName?: string;
      accountNumber?: string;
      initialBalance?: number;
      currentBalance?: number;
      creditLimit?: number;
      interestRate?: number;
      paymentDate?: string;
      dueDate?: string;
      color?: string;
      icon?: string;
      notes?: string;
      isExcludedFromNetWorth?: boolean;
    }
  ) {
    // 1. Verify account type belongs to the user
    const [typeRecord] = await db
      .select()
      .from(accountTypes)
      .where(and(eq(accountTypes.id, payload.accountTypeId), eq(accountTypes.userId, user.id)))
      .limit(1);

    if (!typeRecord) {
      const err: any = new Error("Invalid accountTypeId: Account type does not exist or does not belong to user");
      err.status = 400;
      throw err;
    }

    // Default currency to user's preferred default currency (or 'IDR')
    const currency = (payload.currencyCode || user.defaultCurrency || "IDR").toUpperCase().trim();
    const initialBal = payload.initialBalance ?? 0;
    const currentBal = payload.currentBalance ?? initialBal;

    const [created] = await db
      .insert(accounts)
      .values({
        userId: user.id,
        accountTypeId: payload.accountTypeId,
        currencyCode: currency,
        name: payload.name.trim(),
        institutionName: payload.institutionName?.trim(),
        accountNumber: payload.accountNumber?.trim(),
        initialBalance: initialBal.toString(),
        currentBalance: currentBal.toString(),
        creditLimit: payload.creditLimit ? payload.creditLimit.toString() : null,
        interestRate: payload.interestRate ? payload.interestRate.toString() : null,
        paymentDate: payload.paymentDate ? payload.paymentDate.trim() : null,
        dueDate: payload.dueDate ? payload.dueDate.trim() : null,
        color: payload.color?.trim() || typeRecord.color,
        icon: payload.icon?.trim() || typeRecord.icon,
        notes: payload.notes?.trim(),
        isExcludedFromNetWorth: payload.isExcludedFromNetWorth ?? false,
        isArchived: false,
      })
      .returning();

    logger.success(`Created account '${created.name}' (${created.currencyCode}) for user`, {
      id: created.id,
      userId: user.id,
    });

    return this.formatAccount(created, typeRecord);
  }

  /**
   * Update account.
   */
  public async updateAccount(
    user: SafeUser,
    id: string,
    payload: {
      name?: string;
      accountTypeId?: string;
      currencyCode?: string;
      institutionName?: string;
      accountNumber?: string;
      currentBalance?: number;
      creditLimit?: number;
      interestRate?: number;
      paymentDate?: string;
      dueDate?: string;
      color?: string;
      icon?: string;
      notes?: string;
      isExcludedFromNetWorth?: boolean;
      isArchived?: boolean;
    }
  ) {
    // 1. Verify account exists and belongs to user
    const [existing] = await db
      .select()
      .from(accounts)
      .where(and(eq(accounts.id, id), eq(accounts.userId, user.id)))
      .limit(1);

    if (!existing) {
      const err: any = new Error("Account not found");
      err.status = 404;
      throw err;
    }

    // 2. If changing accountTypeId, verify new type belongs to user
    let typeRecord: AccountType | undefined;
    if (payload.accountTypeId) {
      const [foundType] = await db
        .select()
        .from(accountTypes)
        .where(and(eq(accountTypes.id, payload.accountTypeId), eq(accountTypes.userId, user.id)))
        .limit(1);

      if (!foundType) {
        const err: any = new Error("Invalid accountTypeId: Account type not found");
        err.status = 400;
        throw err;
      }
      typeRecord = foundType;
    } else {
      const [foundType] = await db
        .select()
        .from(accountTypes)
        .where(eq(accountTypes.id, existing.accountTypeId))
        .limit(1);
      typeRecord = foundType;
    }

    const [updated] = await db
      .update(accounts)
      .set({
        name: payload.name ? payload.name.trim() : undefined,
        accountTypeId: payload.accountTypeId,
        currencyCode: payload.currencyCode ? payload.currencyCode.toUpperCase().trim() : undefined,
        institutionName: payload.institutionName !== undefined ? payload.institutionName?.trim() : undefined,
        accountNumber: payload.accountNumber !== undefined ? payload.accountNumber?.trim() : undefined,
        currentBalance: payload.currentBalance !== undefined ? payload.currentBalance.toString() : undefined,
        creditLimit: payload.creditLimit !== undefined ? payload.creditLimit.toString() : undefined,
        interestRate: payload.interestRate !== undefined ? payload.interestRate.toString() : undefined,
        paymentDate: payload.paymentDate !== undefined ? (payload.paymentDate ? payload.paymentDate.trim() : null) : undefined,
        dueDate: payload.dueDate !== undefined ? (payload.dueDate ? payload.dueDate.trim() : null) : undefined,
        color: payload.color !== undefined ? payload.color?.trim() : undefined,
        icon: payload.icon !== undefined ? payload.icon?.trim() : undefined,
        notes: payload.notes !== undefined ? payload.notes?.trim() : undefined,
        isExcludedFromNetWorth: payload.isExcludedFromNetWorth,
        isArchived: payload.isArchived,
      })
      .where(eq(accounts.id, id))
      .returning();

    return this.formatAccount(updated, typeRecord);
  }

  /**
   * Delete account.
   */
  public async deleteAccount(user: SafeUser, id: string) {
    const [existing] = await db
      .select()
      .from(accounts)
      .where(and(eq(accounts.id, id), eq(accounts.userId, user.id)))
      .limit(1);

    if (!existing) {
      const err: any = new Error("Account not found");
      err.status = 404;
      throw err;
    }

    await db.delete(accounts).where(eq(accounts.id, id));
    return { success: true, message: `Account '${existing.name}' deleted successfully` };
  }

  /**
   * Calculate aggregated Net Worth summary across all user accounts.
   * Converts all currencies into the target currency (defaults to user's defaultCurrency).
   */
  public async getNetWorthSummary(user: SafeUser, targetCurrency?: string) {
    const target = (targetCurrency || user.defaultCurrency || "IDR").toUpperCase().trim();

    // Query active, non-excluded accounts
    const activeRows = await db
      .select({
        account: accounts,
        accountType: {
          nature: accountTypes.nature,
        },
      })
      .from(accounts)
      .innerJoin(accountTypes, eq(accounts.accountTypeId, accountTypes.id))
      .where(
        and(
          eq(accounts.userId, user.id),
          eq(accounts.isArchived, false),
          eq(accounts.isExcludedFromNetWorth, false)
        )
      );

    let totalAssets = 0;
    let totalLiabilities = 0;

    // Currency breakdown map
    const breakdownMap = new Map<string, { assets: number; liabilities: number; count: number }>();

    for (const row of activeRows) {
      const rawBalance = parseFloat(row.account.currentBalance) || 0;
      const currency = row.account.currencyCode.toUpperCase();
      const nature = row.accountType.nature as AccountNature;

      // Update per-currency breakdown
      if (!breakdownMap.has(currency)) {
        breakdownMap.set(currency, { assets: 0, liabilities: 0, count: 0 });
      }
      const entry = breakdownMap.get(currency)!;
      entry.count += 1;

      if (nature === "asset") {
        entry.assets += rawBalance;
      } else {
        // Liabilities are stored as debt amount
        entry.liabilities += Math.abs(rawBalance);
      }

      // Convert to target currency
      const convertedBalance = await currencyService.convertAmount(
        user,
        Math.abs(rawBalance),
        currency,
        target
      );

      if (nature === "asset") {
        totalAssets += convertedBalance;
      } else {
        totalLiabilities += convertedBalance;
      }
    }

    const netWorth = totalAssets - totalLiabilities;

    const byCurrency = Array.from(breakdownMap.entries()).map(([currencyCode, val]) => ({
      currencyCode,
      assets: val.assets.toFixed(2),
      liabilities: val.liabilities.toFixed(2),
      accountsCount: val.count,
    }));

    return {
      targetCurrency: target,
      totalAssets: totalAssets.toFixed(2),
      totalLiabilities: totalLiabilities.toFixed(2),
      netWorth: netWorth.toFixed(2),
      accountsCount: activeRows.length,
      byCurrency,
    };
  }
}

export const accountService = new AccountService();

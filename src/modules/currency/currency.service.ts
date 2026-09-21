import { and, desc, eq, or, ilike, isNull } from "drizzle-orm";
import { db } from "../../db";
import { currencies, exchangeRates, Currency, ExchangeRate } from "../../db/schema";
import { paginateArray, PaginationMeta } from "../../utils/pagination";
import { logger } from "../../utils/logger";
import { SafeUser } from "../auth/auth.service";

export class CurrencyService {
  /**
   * Format currency DB entity into client model.
   */
  private formatCurrency(record: Currency) {
    return {
      ...record,
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString(),
    };
  }

  /**
   * Format exchange rate DB entity into client model.
   */
  private formatExchangeRate(record: ExchangeRate) {
    return {
      ...record,
      rate: record.rate.toString(),
      effectiveDate: record.effectiveDate.toISOString(),
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString(),
    };
  }

  /**
   * List all currencies accessible to the authenticated user.
   * Returns universal system currencies plus user's personal custom currencies.
   */
  public async listCurrencies(
    user: SafeUser,
    query?: {
      search?: string;
      isActive?: boolean;
      page?: number;
      limit?: number;
    }
  ): Promise<{ data: ReturnType<CurrencyService["formatCurrency"]>[]; pagination?: PaginationMeta }> {
    const rawList = await db
      .select()
      .from(currencies)
      .where(
        and(
          or(isNull(currencies.userId), eq(currencies.userId, user.id)),
          query?.isActive !== undefined ? eq(currencies.isActive, query.isActive) : undefined,
          query?.search
            ? or(
                ilike(currencies.code, `%${query.search.trim()}%`),
                ilike(currencies.name, `%${query.search.trim()}%`)
              )
            : undefined
        )
      )
      .orderBy(desc(currencies.isSystem), currencies.code);

    const formatted = rawList.map((c) => this.formatCurrency(c));
    return paginateArray(formatted, query);
  }

  /**
   * Get single currency by ID.
   */
  public async getCurrencyById(user: SafeUser, id: string) {
    const [record] = await db
      .select()
      .from(currencies)
      .where(
        and(
          eq(currencies.id, id),
          or(isNull(currencies.userId), eq(currencies.userId, user.id))
        )
      )
      .limit(1);

    if (!record) {
      const err: any = new Error("Currency not found");
      err.status = 404;
      throw err;
    }

    return this.formatCurrency(record);
  }

  /**
   * Create a new currency.
   * If user is admin and isSystem is requested -> creates universal currency (userId = null, isSystem = true).
   * Otherwise -> creates user-bound custom currency (userId = user.id, isSystem = false).
   */
  public async createCurrency(
    user: SafeUser,
    payload: {
      code: string;
      name: string;
      symbol: string;
      symbolPosition?: "prefix" | "suffix";
      decimalDigits?: number;
      isBase?: boolean;
      isSystem?: boolean;
    }
  ) {
    const code = payload.code.trim().toUpperCase();
    const isSystemCreation = Boolean(payload.isSystem && user.role === "admin");
    const targetUserId = isSystemCreation ? null : user.id;

    // Check for duplicate currency code in the same scope
    const existing = await db
      .select({ id: currencies.id })
      .from(currencies)
      .where(
        and(
          isSystemCreation ? isNull(currencies.userId) : eq(currencies.userId, user.id),
          eq(currencies.code, code)
        )
      )
      .limit(1);

    if (existing.length > 0) {
      const err: any = new Error(`Currency with code '${code}' already exists`);
      err.status = 409;
      throw err;
    }

    const [created] = await db
      .insert(currencies)
      .values({
        userId: targetUserId,
        code,
        name: payload.name.trim(),
        symbol: payload.symbol.trim(),
        symbolPosition: payload.symbolPosition || "prefix",
        decimalDigits: payload.decimalDigits ?? (code === "IDR" ? 0 : 2),
        isBase: Boolean(payload.isBase && user.role === "admin"),
        isSystem: isSystemCreation,
        isActive: true,
      })
      .returning();

    logger.success(`Created currency ${created.code}`, {
      id: created.id,
      isSystem: created.isSystem,
      userId: created.userId,
    });

    return this.formatCurrency(created);
  }

  /**
   * Update currency. System currencies require Admin role; custom currencies require ownership.
   */
  public async updateCurrency(
    user: SafeUser,
    id: string,
    payload: {
      name?: string;
      symbol?: string;
      symbolPosition?: "prefix" | "suffix";
      decimalDigits?: number;
      isActive?: boolean;
    }
  ) {
    const [existing] = await db
      .select()
      .from(currencies)
      .where(eq(currencies.id, id))
      .limit(1);

    if (!existing) {
      const err: any = new Error("Currency not found");
      err.status = 404;
      throw err;
    }

    if (existing.userId === null && user.role !== "admin") {
      const err: any = new Error("Forbidden: System currency can only be modified by administrators");
      err.status = 403;
      throw err;
    }

    if (existing.userId !== null && existing.userId !== user.id) {
      const err: any = new Error("Forbidden: Cannot modify another user's custom currency");
      err.status = 403;
      throw err;
    }

    const [updated] = await db
      .update(currencies)
      .set({
        name: payload.name ? payload.name.trim() : undefined,
        symbol: payload.symbol ? payload.symbol.trim() : undefined,
        symbolPosition: payload.symbolPosition,
        decimalDigits: payload.decimalDigits,
        isActive: payload.isActive,
      })
      .where(eq(currencies.id, id))
      .returning();

    return this.formatCurrency(updated);
  }

  /**
   * Delete or deactivate currency.
   */
  public async deleteCurrency(user: SafeUser, id: string) {
    const [existing] = await db
      .select()
      .from(currencies)
      .where(eq(currencies.id, id))
      .limit(1);

    if (!existing) {
      const err: any = new Error("Currency not found");
      err.status = 404;
      throw err;
    }

    if (existing.userId === null && user.role !== "admin") {
      const err: any = new Error("Forbidden: System currency can only be deleted by administrators");
      err.status = 403;
      throw err;
    }

    if (existing.userId !== null && existing.userId !== user.id) {
      const err: any = new Error("Forbidden: Cannot delete another user's custom currency");
      err.status = 403;
      throw err;
    }

    await db.delete(currencies).where(eq(currencies.id, id));
    return { success: true, message: `Currency ${existing.code} deleted successfully` };
  }

  // --- Exchange Rates Services ---

  /**
   * List exchange rates accessible to the authenticated user.
   */
  public async listExchangeRates(
    user: SafeUser,
    query?: {
      fromCurrency?: string;
      toCurrency?: string;
      page?: number;
      limit?: number;
    }
  ): Promise<{ data: ReturnType<CurrencyService["formatExchangeRate"]>[]; pagination?: PaginationMeta }> {
    const rawList = await db
      .select()
      .from(exchangeRates)
      .where(
        and(
          or(isNull(exchangeRates.userId), eq(exchangeRates.userId, user.id)),
          query?.fromCurrency ? eq(exchangeRates.fromCurrency, query.fromCurrency.toUpperCase()) : undefined,
          query?.toCurrency ? eq(exchangeRates.toCurrency, query.toCurrency.toUpperCase()) : undefined
        )
      )
      .orderBy(desc(exchangeRates.effectiveDate));

    const formatted = rawList.map((r) => this.formatExchangeRate(r));
    return paginateArray(formatted, query);
  }

  /**
   * Get single exchange rate by ID.
   */
  public async getExchangeRateById(user: SafeUser, id: string) {
    const [record] = await db
      .select()
      .from(exchangeRates)
      .where(
        and(
          eq(exchangeRates.id, id),
          or(isNull(exchangeRates.userId), eq(exchangeRates.userId, user.id))
        )
      )
      .limit(1);

    if (!record) {
      const err: any = new Error("Exchange rate not found");
      err.status = 404;
      throw err;
    }

    return this.formatExchangeRate(record);
  }

  /**
   * Create or insert an exchange rate.
   * Admin can create universal rate (userId = null) or personal rate.
   * User creates personal custom rate (userId = user.id).
   */
  public async createExchangeRate(
    user: SafeUser,
    payload: {
      fromCurrency: string;
      toCurrency?: string;
      rate: number;
      effectiveDate?: string;
      isSystem?: boolean;
    }
  ) {
    const fromCurrency = payload.fromCurrency.trim().toUpperCase();
    const toCurrency = (payload.toCurrency || "IDR").trim().toUpperCase();
    const isSystemCreation = Boolean(payload.isSystem && user.role === "admin");
    const targetUserId = isSystemCreation ? null : user.id;

    const [created] = await db
      .insert(exchangeRates)
      .values({
        userId: targetUserId,
        fromCurrency,
        toCurrency,
        rate: payload.rate.toString(),
        effectiveDate: payload.effectiveDate ? new Date(payload.effectiveDate) : new Date(),
      })
      .returning();

    logger.success(`Recorded exchange rate ${fromCurrency} -> ${toCurrency}: ${payload.rate}`, {
      id: created.id,
      isSystem: isSystemCreation,
    });

    return this.formatExchangeRate(created);
  }

  /**
   * Delete an exchange rate record by ID.
   */
  public async deleteExchangeRate(user: SafeUser, id: string) {
    const [existing] = await db
      .select()
      .from(exchangeRates)
      .where(eq(exchangeRates.id, id))
      .limit(1);

    if (!existing) {
      const err: any = new Error("Exchange rate not found");
      err.status = 404;
      throw err;
    }

    if (existing.userId === null && user.role !== "admin") {
      const err: any = new Error("Forbidden: System rates can only be deleted by administrators");
      err.status = 403;
      throw err;
    }

    if (existing.userId !== null && existing.userId !== user.id) {
      const err: any = new Error("Forbidden: Cannot delete another user's exchange rate");
      err.status = 403;
      throw err;
    }

    await db.delete(exchangeRates).where(eq(exchangeRates.id, id));
    return { success: true, message: "Exchange rate deleted successfully" };
  }

  /**
   * Convert an amount between two currencies using latest stored rates.
   * Checks user custom rate first, then falls back to system rates.
   */
  public async convertAmount(
    user: SafeUser,
    amount: number,
    fromCurrency: string,
    toCurrency: string
  ): Promise<number> {
    const from = fromCurrency.toUpperCase().trim();
    const to = toCurrency.toUpperCase().trim();

    if (from === to) return amount;

    // Helper to query latest rate between a pair
    const findLatestRate = async (f: string, t: string): Promise<number | null> => {
      // 1. Check user custom rate
      const [custom] = await db
        .select({ rate: exchangeRates.rate })
        .from(exchangeRates)
        .where(
          and(
            eq(exchangeRates.userId, user.id),
            eq(exchangeRates.fromCurrency, f),
            eq(exchangeRates.toCurrency, t)
          )
        )
        .orderBy(desc(exchangeRates.effectiveDate))
        .limit(1);

      if (custom) return parseFloat(custom.rate);

      // 2. Check universal system rate
      const [system] = await db
        .select({ rate: exchangeRates.rate })
        .from(exchangeRates)
        .where(
          and(
            isNull(exchangeRates.userId),
            eq(exchangeRates.fromCurrency, f),
            eq(exchangeRates.toCurrency, t)
          )
        )
        .orderBy(desc(exchangeRates.effectiveDate))
        .limit(1);

      if (system) return parseFloat(system.rate);

      return null;
    };

    // Direct conversion
    const directRate = await findLatestRate(from, to);
    if (directRate !== null && directRate > 0) {
      return amount * directRate;
    }

    // Inverse conversion
    const inverseRate = await findLatestRate(to, from);
    if (inverseRate !== null && inverseRate > 0) {
      return amount / inverseRate;
    }

    // Cross-currency conversion via base currency (IDR)
    if (from !== "IDR" && to !== "IDR") {
      const fromToIdr = await findLatestRate(from, "IDR");
      const toToIdr = await findLatestRate(to, "IDR");

      if (fromToIdr !== null && toToIdr !== null && toToIdr > 0) {
        const amountInIdr = amount * fromToIdr;
        return amountInIdr / toToIdr;
      }
    }

    // Fallback: 1:1 if no exchange rate is recorded
    logger.warn(`No exchange rate found for ${from} -> ${to}. Defaulting to 1:1 conversion.`);
    return amount;
  }
}

export const currencyService = new CurrencyService();

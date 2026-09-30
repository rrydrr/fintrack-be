import { eq } from "drizzle-orm";
import { db } from "../../../db";
import { users, UserRole } from "../../../db/schema";
import { logger } from "../../../utils/logger";

export interface SafeUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  defaultCurrency: string;
  emailVerified: boolean;
  emailVerifiedAt: string | null;
}

/**
 * Format internal user record into sanitized client-safe profile.
 */
export function toSafeUser(user: {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  defaultCurrency?: string | null;
  emailVerifiedAt?: Date | null;
}): SafeUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    defaultCurrency: user.defaultCurrency || "IDR",
    emailVerified: Boolean(user.emailVerifiedAt),
    emailVerifiedAt: user.emailVerifiedAt ? user.emailVerifiedAt.toISOString() : null,
  };
}

export class UserService {
  /**
   * Find user profile by unique ID.
   */
  public async findById(id: string): Promise<SafeUser> {
    const [user] = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        role: users.role,
        defaultCurrency: users.defaultCurrency,
        emailVerifiedAt: users.emailVerifiedAt,
      })
      .from(users)
      .where(eq(users.id, id))
      .limit(1);

    if (!user) {
      const err: any = new Error("User not found");
      err.status = 404;
      throw err;
    }

    return toSafeUser(user);
  }

  /**
   * Find raw user by email (internal use for login/registration checks).
   */
  public async findByEmail(email: string) {
    const normalizedEmail = email.toLowerCase().trim();
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, normalizedEmail))
      .limit(1);

    return user || null;
  }

  /**
   * Update the user's preferred default base currency.
   */
  public async updateDefaultCurrency(userId: string, currencyCode: string): Promise<SafeUser> {
    const normalized = currencyCode.trim().toUpperCase();

    const [updated] = await db
      .update(users)
      .set({ defaultCurrency: normalized })
      .where(eq(users.id, userId))
      .returning({
        id: users.id,
        name: users.name,
        email: users.email,
        role: users.role,
        defaultCurrency: users.defaultCurrency,
        emailVerifiedAt: users.emailVerifiedAt,
      });

    if (!updated) {
      const err: any = new Error("User not found");
      err.status = 404;
      throw err;
    }

    logger.info(`Updated default currency to ${normalized} for user`, { userId });
    return toSafeUser(updated);
  }
}

export const userService = new UserService();

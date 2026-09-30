import { and, desc, eq, isNull } from "drizzle-orm";
import { randomBytes, createHash } from "node:crypto";
import { config } from "../../config/env";
import { db } from "../../db";
import {
  users,
  refreshTokens,
  inviteCodes,
  emailVerificationTokens,
  UserRole,
} from "../../db/schema";
import { logger } from "../../utils/logger";
import { sendVerificationEmail } from "../../utils/email";

import { accountTypeService } from "../account-type/account-type.service";

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
function toSafeUser(user: {
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

/**
 * Hash raw token using SHA-256 for secure database storage.
 */
function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * Generate human-friendly cryptographically random invite code: FIN-XXXX-XXXX
 */
function generateInviteCode(): string {
  const part1 = randomBytes(2).toString("hex").toUpperCase();
  const part2 = randomBytes(2).toString("hex").toUpperCase();
  return `FIN-${part1}-${part2}`;
}

export class AuthService {
  /**
   * Register a new user with hashed password and valid one-time invite code.
   */
  public async register(payload: {
    name: string;
    email: string;
    password: string;
    inviteCode: string;
    role?: UserRole;
  }): Promise<SafeUser> {
    const normalizedCode = (payload.inviteCode || "").trim().toUpperCase();

    if (!normalizedCode) {
      const err: any = new Error("Invite code is required to register");
      err.status = 400;
      throw err;
    }

    // 1. Validate invite code
    const [invite] = await db
      .select()
      .from(inviteCodes)
      .where(eq(inviteCodes.code, normalizedCode))
      .limit(1);

    if (!invite) {
      const err: any = new Error("Invalid invite code");
      err.status = 400;
      throw err;
    }

    if (invite.usedAt) {
      const err: any = new Error("Invite code has already been used");
      err.status = 400;
      throw err;
    }

    if (new Date() > invite.expiresAt) {
      const err: any = new Error("Invite code has expired");
      err.status = 400;
      throw err;
    }

    const normalizedEmail = payload.email.toLowerCase().trim();

    // 2. Check if email already exists
    const [existing] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, normalizedEmail))
      .limit(1);

    if (existing) {
      const err: any = new Error("Email is already registered");
      err.status = 409;
      throw err;
    }

    // 3. Hash password with Bun native bcrypt
    const passwordHash = await Bun.password.hash(payload.password, {
      algorithm: "bcrypt",
      cost: 10,
    });

    // 4. Atomically insert user and mark invite code as redeemed
    const newUser = await db.transaction(async (tx) => {
      const [createdUser] = await tx
        .insert(users)
        .values({
          name: payload.name.trim(),
          email: normalizedEmail,
          passwordHash,
          role: payload.role || "user",
        })
        .returning({
          id: users.id,
          name: users.name,
          email: users.email,
          role: users.role,
          defaultCurrency: users.defaultCurrency,
          emailVerifiedAt: users.emailVerifiedAt,
        });

      await tx
        .update(inviteCodes)
        .set({
          usedAt: new Date(),
          usedBy: createdUser.id,
        })
        .where(eq(inviteCodes.id, invite.id));

      return createdUser;
    });

    // 5. Automatically provision initial account types for the new user from master templates
    try {
      await accountTypeService.seedUserAccountTypes(newUser.id);
    } catch (seedErr) {
      logger.error("Failed to seed user account types upon registration", seedErr);
    }

    logger.success("User registered with invite code successfully", {
      id: newUser.id,
      email: newUser.email,
      role: newUser.role,
      inviteCode: normalizedCode,
    });

    // Asynchronously dispatch verification email without blocking registration
    this.sendVerificationEmailForUser({
      id: newUser.id,
      email: newUser.email,
      name: newUser.name,
    }).catch((emailErr) => {
      logger.error("Failed to send verification email upon registration", emailErr);
    });

    return toSafeUser(newUser);
  }

  /**
   * Authenticate user credentials and return user profile.
   */
  public async login(payload: {
    email: string;
    password: string;
  }): Promise<SafeUser> {
    const normalizedEmail = payload.email.toLowerCase().trim();

    // Query user by email
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, normalizedEmail))
      .limit(1);

    if (!user) {
      const err: any = new Error("Invalid email or password");
      err.status = 401;
      throw err;
    }

    // Verify password against stored hash
    const isMatch = await Bun.password.verify(payload.password, user.passwordHash);
    if (!isMatch) {
      const err: any = new Error("Invalid email or password");
      err.status = 401;
      throw err;
    }

    logger.info("User logged in successfully", {
      id: user.id,
      email: user.email,
      role: user.role,
    });

    return toSafeUser(user);
  }

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
   * Generate a cryptographically secure refresh token and store its hash in DB.
   */
  public async createRefreshToken(userId: string): Promise<string> {
    const rawToken = randomBytes(32).toString("hex");
    const tokenHash = hashToken(rawToken);

    const expiresAt = new Date(
      Date.now() + config.jwtRefreshExpDays * 24 * 60 * 60 * 1000
    );

    await db.insert(refreshTokens).values({
      userId,
      tokenHash,
      expiresAt,
    });

    return rawToken;
  }

  /**
   * Rotate a refresh token:
   * - Detects token reuse (if token was already revoked past grace period, revokes all user sessions!)
   * - Grace period (15s): Handles concurrent parallel requests from single-page apps safely
   * - Validates expiration
   * - Revokes old token and issues a new refresh token linked via replacedByTokenHash
   */
  public async rotateRefreshToken(
    rawToken: string
  ): Promise<{ user: SafeUser; newRefreshToken: string }> {
    const tokenHash = hashToken(rawToken);

    const [record] = await db
      .select()
      .from(refreshTokens)
      .where(eq(refreshTokens.tokenHash, tokenHash))
      .limit(1);

    if (!record) {
      const err: any = new Error("Invalid refresh token");
      err.status = 401;
      throw err;
    }

    const GRACE_PERIOD_MS = 15000; // 15 seconds grace window for concurrent requests

    // Reuse detection: Token has already been revoked
    if (record.revokedAt) {
      const elapsedSinceRevocation = Date.now() - record.revokedAt.getTime();

      // Only allow grace period if token was revoked by normal rotation (has replacedByTokenHash link).
      // Tokens revoked via explicit logout or past grace period are strictly rejected!
      if (
        record.replacedByTokenHash &&
        elapsedSinceRevocation <= GRACE_PERIOD_MS
      ) {
        logger.info("Concurrent refresh request handled within grace period", {
          userId: record.userId,
          elapsedMs: elapsedSinceRevocation,
        });

        const newRefreshToken = await this.createRefreshToken(record.userId);
        const user = await this.findById(record.userId);

        return {
          user,
          newRefreshToken,
        };
      }

      // Past grace period: potential token reuse breach!
      await this.revokeAllUserTokens(record.userId);
      logger.warn("Potential token reuse detected. Revoked all tokens for user.", {
        userId: record.userId,
        elapsedMs: elapsedSinceRevocation,
      });

      const err: any = new Error("Invalid refresh token: token reuse detected");
      err.status = 401;
      throw err;
    }

    // Check expiration
    if (new Date() > record.expiresAt) {
      const err: any = new Error("Refresh token expired");
      err.status = 401;
      throw err;
    }

    // Issue new refresh token
    const newRawToken = randomBytes(32).toString("hex");
    const newHash = hashToken(newRawToken);
    const expiresAt = new Date(
      Date.now() + config.jwtRefreshExpDays * 24 * 60 * 60 * 1000
    );

    await db.insert(refreshTokens).values({
      userId: record.userId,
      tokenHash: newHash,
      expiresAt,
    });

    // Revoke the presented token with replacedBy pointer
    await db
      .update(refreshTokens)
      .set({
        revokedAt: new Date(),
        replacedByTokenHash: newHash,
      })
      .where(eq(refreshTokens.id, record.id));

    const user = await this.findById(record.userId);

    logger.info("Rotated refresh token successfully", {
      userId: record.userId,
    });

    return {
      user,
      newRefreshToken: newRawToken,
    };
  }

  /**
   * Explicitly revoke a refresh token (e.g. on logout).
   */
  public async revokeRefreshToken(rawToken: string): Promise<void> {
    const tokenHash = hashToken(rawToken);

    await db
      .update(refreshTokens)
      .set({ revokedAt: new Date() })
      .where(
        and(
          eq(refreshTokens.tokenHash, tokenHash),
          isNull(refreshTokens.revokedAt)
        )
      );

    logger.info("Refresh token revoked");
  }

  /**
   * Revoke all active refresh tokens for a user.
   */
  public async revokeAllUserTokens(userId: string): Promise<void> {
    await db
      .update(refreshTokens)
      .set({ revokedAt: new Date() })
      .where(
        and(
          eq(refreshTokens.userId, userId),
          isNull(refreshTokens.revokedAt)
        )
      );

    logger.info("Revoked all refresh tokens for user", { userId });
  }

  /**
   * Generate a one-time registration invite code expiring in N days (default: 7).
   */
  public async createInviteCode(
    adminUserId: string,
    expiresInDays = 7
  ): Promise<{
    id: string;
    code: string;
    createdBy: string;
    usedBy: string | null;
    expiresAt: string;
    usedAt: string | null;
    createdAt: string;
  }> {
    const code = generateInviteCode();
    const expiresAt = new Date(
      Date.now() + expiresInDays * 24 * 60 * 60 * 1000
    );

    const [record] = await db
      .insert(inviteCodes)
      .values({
        code,
        createdBy: adminUserId,
        expiresAt,
      })
      .returning();

    logger.info("Admin generated new invite code", {
      adminUserId,
      code,
      expiresAt: record.expiresAt,
    });

    return {
      id: record.id,
      code: record.code,
      createdBy: record.createdBy,
      usedBy: record.usedBy,
      expiresAt: record.expiresAt.toISOString(),
      usedAt: record.usedAt ? record.usedAt.toISOString() : null,
      createdAt: record.createdAt.toISOString(),
    };
  }

  /**
   * List all invite codes for admin review.
   */
  public async listInviteCodes() {
    const records = await db
      .select()
      .from(inviteCodes)
      .orderBy(desc(inviteCodes.createdAt));

    return records.map((r) => ({
      id: r.id,
      code: r.code,
      createdBy: r.createdBy,
      usedBy: r.usedBy,
      expiresAt: r.expiresAt.toISOString(),
      usedAt: r.usedAt ? r.usedAt.toISOString() : null,
      createdAt: r.createdAt.toISOString(),
    }));
  }

  /**
   * Revoke an active unused invite code.
   */
  public async revokeInviteCode(inviteId: string): Promise<void> {
    const [record] = await db
      .select()
      .from(inviteCodes)
      .where(eq(inviteCodes.id, inviteId))
      .limit(1);

    if (!record) {
      const err: any = new Error("Invite code not found");
      err.status = 404;
      throw err;
    }

    if (record.usedAt) {
      const err: any = new Error("Cannot revoke an already used invite code");
      err.status = 400;
      throw err;
    }

    await db.delete(inviteCodes).where(eq(inviteCodes.id, inviteId));
    logger.info("Admin revoked invite code", { inviteId });
  }

  /**
   * Generate an email verification token and store its hash in DB.
   */
  public async createVerificationToken(
    userId: string,
    expiresInHours = 24
  ): Promise<string> {
    const rawToken = randomBytes(32).toString("hex");
    const tokenHash = hashToken(rawToken);

    // Invalidate any existing unused verification tokens for this user
    await db
      .update(emailVerificationTokens)
      .set({ usedAt: new Date() })
      .where(
        and(
          eq(emailVerificationTokens.userId, userId),
          isNull(emailVerificationTokens.usedAt)
        )
      );

    const expiresAt = new Date(
      Date.now() + expiresInHours * 60 * 60 * 1000
    );

    await db.insert(emailVerificationTokens).values({
      userId,
      tokenHash,
      expiresAt,
    });

    return rawToken;
  }

  /**
   * Generate a token and send verification email for a user.
   * Ensures the user exists in the database and is unverified before sending.
   */
  public async sendVerificationEmailForUser(user: {
    id: string;
    email?: string;
    name?: string;
  }): Promise<void> {
    const [existingUser] = await db
      .select({
        id: users.id,
        email: users.email,
        name: users.name,
        emailVerifiedAt: users.emailVerifiedAt,
      })
      .from(users)
      .where(eq(users.id, user.id))
      .limit(1);

    if (!existingUser) {
      logger.warn("Cannot send verification email: User not found in database", {
        userId: user.id,
      });
      return;
    }

    if (existingUser.emailVerifiedAt) {
      logger.info("Verification email skipped: User is already verified", {
        userId: user.id,
        email: existingUser.email,
      });
      return;
    }

    const token = await this.createVerificationToken(existingUser.id);
    const result = await sendVerificationEmail({
      to: existingUser.email,
      name: existingUser.name,
      token,
    });

    if (!result.success) {
      logger.warn(
        `Failed to send verification email to ${existingUser.email}: ${result.error}`
      );
    }
  }

  /**
   * Verify an email address using a raw verification token.
   */
  public async verifyEmail(rawToken: string): Promise<SafeUser> {
    const normalizedToken = (rawToken || "").trim();

    if (!normalizedToken) {
      const err: any = new Error("Verification token is required");
      err.status = 400;
      throw err;
    }

    const tokenHash = hashToken(normalizedToken);

    const [record] = await db
      .select()
      .from(emailVerificationTokens)
      .where(eq(emailVerificationTokens.tokenHash, tokenHash))
      .limit(1);

    if (!record) {
      const err: any = new Error("Invalid verification token");
      err.status = 400;
      throw err;
    }

    if (record.usedAt) {
      const err: any = new Error("This verification token has already been used");
      err.status = 400;
      throw err;
    }

    if (new Date() > record.expiresAt) {
      const err: any = new Error("Verification token has expired");
      err.status = 400;
      throw err;
    }

    // Atomically mark token as used and set emailVerifiedAt on the user
    const updatedUser = await db.transaction(async (tx) => {
      await tx
        .update(emailVerificationTokens)
        .set({ usedAt: new Date() })
        .where(eq(emailVerificationTokens.id, record.id));

      const [user] = await tx
        .update(users)
        .set({ emailVerifiedAt: new Date() })
        .where(eq(users.id, record.userId))
        .returning({
          id: users.id,
          name: users.name,
          email: users.email,
          role: users.role,
          emailVerifiedAt: users.emailVerifiedAt,
        });

      return user;
    });

    if (!updatedUser) {
      const err: any = new Error("User account not found");
      err.status = 404;
      throw err;
    }

    logger.success("User email verified successfully", {
      id: updatedUser.id,
      email: updatedUser.email,
    });

    return toSafeUser(updatedUser);
  }

  /**
   * Resend a verification email to a registered user.
   * Checks database first. If the email does not exist in DB or is already verified,
   * sending is silently suppressed to prevent user enumeration attacks.
   */
  public async resendVerificationEmail(email: string): Promise<void> {
    const normalizedEmail = (email || "").toLowerCase().trim();

    if (!normalizedEmail) {
      const err: any = new Error("Email address is required");
      err.status = 400;
      throw err;
    }

    const [user] = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        role: users.role,
        emailVerifiedAt: users.emailVerifiedAt,
      })
      .from(users)
      .where(eq(users.email, normalizedEmail))
      .limit(1);

    if (!user) {
      logger.info(
        "Resend verification suppressed: Email not found in database",
        { email: normalizedEmail }
      );
      return;
    }

    if (user.emailVerifiedAt) {
      logger.info(
        "Resend verification suppressed: User is already verified",
        { email: user.email }
      );
      return;
    }

    await this.sendVerificationEmailForUser(user);
    logger.info("Resent verification email", { email: user.email });
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

export const authService = new AuthService();


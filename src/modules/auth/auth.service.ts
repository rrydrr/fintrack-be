import { and, desc, eq, isNull } from "drizzle-orm";
import { randomBytes, createHash } from "node:crypto";
import { config } from "../../config/env";
import { db } from "../../db";
import { users, refreshTokens, inviteCodes, UserRole } from "../../db/schema";
import { logger } from "../../utils/logger";

export interface SafeUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
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

    logger.success("User registered with invite code successfully", {
      id: newUser.id,
      email: newUser.email,
      role: newUser.role,
      inviteCode: normalizedCode,
    });

    return newUser;
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

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    };
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
      })
      .from(users)
      .where(eq(users.id, id))
      .limit(1);

    if (!user) {
      const err: any = new Error("User not found");
      err.status = 404;
      throw err;
    }

    return user;
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
}

export const authService = new AuthService();


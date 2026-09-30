import { and, eq, isNull } from "drizzle-orm";
import { randomBytes, createHash } from "node:crypto";
import { config } from "../../../config/env";
import { db } from "../../../db";
import { refreshTokens } from "../../../db/schema";
import { logger } from "../../../utils/logger";
import { userService, type SafeUser } from "./user.service";

/**
 * Hash raw token using SHA-256 for secure database storage.
 */
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export class TokenService {
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
        const user = await userService.findById(record.userId);

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

    const user = await userService.findById(record.userId);

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
}

export const tokenService = new TokenService();

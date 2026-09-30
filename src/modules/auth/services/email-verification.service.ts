import { and, eq, isNull } from "drizzle-orm";
import { randomBytes } from "node:crypto";
import { db } from "../../../db";
import { emailVerificationTokens, users } from "../../../db/schema";
import { logger } from "../../../utils/logger";
import { sendVerificationEmail } from "../../../utils/email";
import { hashToken } from "./token.service";
import { toSafeUser, type SafeUser } from "./user.service";

export class EmailVerificationService {
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
          defaultCurrency: users.defaultCurrency,
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
}

export const emailVerificationService = new EmailVerificationService();
